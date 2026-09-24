import Phaser from 'phaser';
import { ANIM, CARD, REDUCED_MOTION_FACTOR } from '../../config/theme';
import {
  klondike,
  timeBonus,
  type KlondikeMove,
  type KlondikeRecord,
} from '../../core/games/klondike';
import type { PileSnapshot } from '../../core/games/types';
import type { Settings } from '../../core/settings';
import { rankLabels, t } from '../../i18n';
import { audio } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { analytics } from '../../services/analytics';
import { app, type KlondikeSession } from '../app';
import { generateCardTextures, TEX, type CardMetrics } from '../cardart/textures';
import {
  cardPositions,
  computeKlondikeLayout,
  type KlondikeLayout,
  type Rect,
} from '../layout/klondikeLayout';
import { CardView } from '../objects/CardView';
import { addGlow, playWinAnimation, resetCardAppearance, showToast } from '../objects/Effects';
import { Button, Dialog, type DialogButton } from '../ui/widgets';
import { devicePixelRatio, safeInsets } from '../viewport';
import { formatTime } from '../format';
import { ensureTableImage } from './tableBackground';

type GameMode = 'continue' | 'new';

interface Hit {
  readonly pileId: string;
  readonly cardIndex: number;
}

interface DragState {
  readonly pileId: string;
  readonly cardIndex: number;
  readonly views: CardView[];
  readonly offsets: ReadonlyArray<{ dx: number; dy: number }>;
  readonly grabDX: number;
  readonly grabDY: number;
  readonly targets: readonly string[];
  readonly glows: Phaser.GameObjects.Image[];
}

type ToolbarKey = 'menu' | 'settings' | 'new' | 'hint' | 'undo';

const REST_DEPTH = 100;
const FLY_DEPTH = 10_000;
const DRAG_DEPTH = 25_000;

export class GameScene extends Phaser.Scene {
  private session: KlondikeSession | null = null;
  private mode: GameMode = 'continue';
  private layout!: KlondikeLayout;
  private metrics!: CardMetrics;
  private dpr = 1;

  private table!: Phaser.GameObjects.Image;
  private toolbarBg!: Phaser.GameObjects.Graphics;
  private readonly slots = new Map<string, Phaser.GameObjects.Image>();
  private cards: CardView[] = [];
  private info!: Phaser.GameObjects.Text;
  private buttons!: Record<ToolbarKey, Button>;
  private finishButton!: Button;

  private hintObjects: Phaser.GameObjects.GameObject[] = [];
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  private dialog: Dialog | null = null;
  private dialogBuilder: (() => Dialog) | null = null;

  /** Incrémenté à chaque changement d'état (résultats asynchrones périmés ignorés). */
  private version = 0;
  private cascading = false;
  private cascadeQueue: KlondikeMove[] = [];
  private cascadeTimer: Phaser.Time.TimerEvent | null = null;
  private winFx: { skip: () => void } | null = null;
  private won = false;
  private blockedDismissed = -1;
  private hintPending = false;
  private pointer: {
    id: number;
    x: number;
    y: number;
    hit: Hit | null;
    draggable: boolean;
  } | null = null;
  private drag: DragState | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('Game');
  }

  init(data: { mode?: GameMode }): void {
    this.mode = data.mode ?? 'continue';
    this.session = null;
    this.won = false;
    this.cascading = false;
    this.cascadeQueue = [];
    this.winFx = null;
    this.dialog = null;
    this.dialogBuilder = null;
    this.drag = null;
    this.pointer = null;
    this.hintObjects = [];
    this.cards = [];
    this.slots.clear();
  }

  private get speed(): number {
    return app.settings.reducedMotion ? REDUCED_MOTION_FACTOR : 1;
  }

  private get drawCount(): 1 | 3 {
    return this.session?.options.drawCount ?? app.settings.drawCount;
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  create(): void {
    this.dpr = devicePixelRatio();
    this.computeLayout();
    this.table = ensureTableImage(this);
    this.toolbarBg = this.add.graphics().setDepth(5);

    for (const id of [
      'stock',
      'waste',
      'f0',
      'f1',
      'f2',
      'f3',
      't0',
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
    ]) {
      const icon = id.startsWith('f') ? 'ace' : id.startsWith('t') ? 'king' : 'none';
      this.slots.set(id, this.add.image(0, 0, TEX.slot(icon)).setDepth(1));
    }
    for (let card = 0; card < 52; card++) {
      const view = new CardView(this, card, this.metrics);
      view.setDepth(REST_DEPTH);
      this.cards.push(view);
    }

    this.info = this.add
      .text(0, 0, '', {
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '16px',
        color: '#FAFAF7',
        fontStyle: '600',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6)
      .setAlpha(0.92);

    this.buildButtons();
    this.layoutAll();
    this.bindInput();

    this.scale.on('resize', this.onResize, this);
    this.unsubscribe = app.onSettingsChange((settings, changed) =>
      this.onSettingsChanged(settings, changed),
    );
    // Les écouteurs de `this.events` survivent au redémarrage de la scène : on les retire.
    const onResume = (): void => this.refreshInfo(true);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.unsubscribe?.();
      app.setActiveSession(null);
    });

    void this.loadSession();
  }

  private computeLayout(): void {
    this.layout = computeKlondikeLayout({
      width: this.scale.width,
      height: this.scale.height,
      dpr: this.dpr,
      safe: safeInsets(this.dpr),
      leftHanded: app.settings.leftHanded,
      drawCount: this.drawCount,
      bannerHeight: 0,
      uiScale: 1,
    });
    const labels = rankLabels();
    this.metrics = generateCardTextures(this, this.layout.cardW, this.layout.cardH, {
      rankLabels: labels,
      back: 'waves',
      aceLabel: labels[0] ?? 'A',
    });
  }

  private buildButtons(): void {
    const u = this.layout.unit;
    const make = (icon: ToolbarKey, label: string, onClick: () => void) =>
      new Button(this, 0, 0, {
        width: 80 * u,
        height: 60 * u,
        label,
        icon,
        style: 'toolbar',
        unit: u,
        onClick,
      }).setDepth(7);
    this.buttons = {
      menu: make('menu', t('game.menu'), () => this.goToMenu()),
      settings: make('settings', t('game.settings'), () => this.openSettings()),
      new: make('new', t('game.new'), () => this.askNewGame()),
      hint: make('hint', t('game.hint'), () => void this.requestHint()),
      undo: make('undo', t('game.undo'), () => this.undo()),
    };
    this.finishButton = new Button(this, 0, 0, {
      width: 180 * u,
      height: 52 * u,
      label: t('game.finish'),
      icon: 'finish',
      style: 'accent',
      unit: u,
      onClick: () => this.runAutoComplete(),
    })
      // Au-dessus des cartes posées (une longue colonne peut passer dessous), sous les cartes en vol.
      .setDepth(FLY_DEPTH - 1)
      .setVisible(false);
  }

  private rebuildButtons(): void {
    for (const b of Object.values(this.buttons)) b.destroy();
    this.finishButton.destroy();
    this.buildButtons();
  }

  // ---------------------------------------------------------------------------
  // Mise en page
  // ---------------------------------------------------------------------------

  private layoutAll(): void {
    const { cardW, cardH } = this.layout;
    for (const [id, slot] of this.slots) {
      const p = this.layout.piles[id];
      if (p) slot.setPosition(p.x + cardW / 2, p.y + cardH / 2);
    }
    this.slots.get('waste')?.setAlpha(0.55);

    const { toolbar, infoBar, unit: u } = this.layout;
    this.toolbarBg.clear();
    this.toolbarBg.fillStyle(0x06222b, 0.42);
    this.toolbarBg.fillRect(
      toolbar.x,
      toolbar.y,
      toolbar.w,
      toolbar.vertical ? toolbar.h : this.scale.height - toolbar.y,
    );

    const order: ToolbarKey[] = ['menu', 'settings', 'new', 'hint', 'undo'];
    if (app.settings.leftHanded && !toolbar.vertical) order.reverse();
    if (toolbar.vertical) {
      const span = Math.min(toolbar.h - 24 * u, order.length * 96 * u);
      const bh = span / order.length;
      const y0 = toolbar.y + (toolbar.h - span) / 2;
      order.forEach((key, i) =>
        this.buttons[key]
          .setPosition(toolbar.x + toolbar.w / 2, y0 + bh * (i + 0.5))
          .resize(toolbar.w, bh),
      );
    } else {
      const span = Math.min(toolbar.w, 560 * u);
      const bw = span / order.length;
      const x0 = toolbar.x + (toolbar.w - span) / 2;
      order.forEach((key, i) =>
        this.buttons[key]
          .setPosition(x0 + bw * (i + 0.5), toolbar.y + toolbar.h / 2)
          .resize(bw, toolbar.h),
      );
    }
    const fb = this.layout.finishButton;
    this.finishButton.setPosition(fb.x + fb.w / 2, fb.y + fb.h / 2).resize(fb.w, fb.h);

    this.info.setFontSize(Math.round(16 * u));
    this.info.setPosition(infoBar.x + infoBar.w / 2, infoBar.y + infoBar.h / 2);
    this.refreshInfo(true);
  }

  /** Recalcule la mise en page et met à jour tout l'affichage (taille des cartes comprise). */
  private relayout(): void {
    this.computeLayout();
    for (const view of this.cards) view.setMetrics(this.metrics);
    for (const slot of this.slots.values()) slot.setTexture(slot.texture.key);
    ensureTableImage(this, this.table);
    this.rebuildButtons();
    this.layoutAll();
  }

  private onResize(): void {
    this.dpr = devicePixelRatio();
    this.cancelDrag();
    this.clearHint();
    this.relayout();
    if (this.winFx) this.winFx.skip();
    this.sync(false);
    if (this.dialogBuilder) {
      this.dialog?.destroy();
      this.dialog = this.dialogBuilder();
    }
  }

  private onSettingsChanged(_settings: Settings, changed: ReadonlyArray<keyof Settings>): void {
    if (changed.some((k) => k === 'leftHanded' || k === 'locale')) {
      this.relayout();
      this.sync(false);
    } else if (changed.some((k) => k === 'scoring' || k === 'showTimer')) {
      this.refreshInfo(true);
    }
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  private async loadSession(): Promise<void> {
    let session = this.mode === 'continue' ? app.resumeSession() : null;
    let deal = false;
    if (!session) {
      session = await app.newSession();
      deal = true;
    }
    this.startSession(session, deal);
  }

  private startSession(session: KlondikeSession, deal: boolean): void {
    this.session = session;
    app.setActiveSession(session);
    this.won = false;
    this.cascading = false;
    this.cascadeQueue = [];
    this.version++;
    this.blockedDismissed = -1;
    this.closeDialog();
    this.clearHint();
    this.winFx?.skip();
    this.winFx = null;
    // La place réservée à l'éventail de la défausse dépend du mode de pioche.
    this.relayout();
    const stock = this.layout.piles.stock;
    for (const view of this.cards) {
      resetCardAppearance(view);
      if (deal && stock) {
        view.setFace(false);
        view.placeAt(stock.x, stock.y);
        view.setDepth(REST_DEPTH);
      }
    }
    if (deal) {
      audio.play('deal');
      this.sync(true, true);
    } else {
      this.sync(false);
      this.checkBlocked();
    }
  }

  // ---------------------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------------------

  private moveDuration(distance: number): number {
    const base = ANIM.move * (0.65 + distance / (this.layout.cardH * 5));
    return Math.min(ANIM.moveMax, base) / this.speed;
  }

  private dealDelay(pile: PileSnapshot, index: number): number {
    if (pile.kind !== 'tableau') return 0;
    let order = 0;
    for (let r = 0; r < index; r++) order += 7 - r;
    order += pile.index - index;
    return (order * ANIM.dealStagger) / this.speed;
  }

  /** Aligne chaque carte sur l'état du jeu (avec ou sans animation). */
  private sync(animate: boolean, deal = false): void {
    const session = this.session;
    if (!session) return;
    let flight = 0;
    for (const pile of klondike.piles(session.state)) {
      const positions = cardPositions(this.layout, pile.id, pile.cards, this.drawCount);
      pile.cards.forEach((face, i) => {
        const view = this.cards[face.card] as CardView;
        const pos = positions[i] as { x: number; y: number };
        const rest = REST_DEPTH + i;
        const moving = !view.isMovingTo(pos.x, pos.y);
        if (animate && moving) {
          const duration = this.moveDuration(Math.hypot(pos.x - view.left, pos.y - view.top));
          const delay = deal ? this.dealDelay(pile, i) : 0;
          view.setDepth(FLY_DEPTH + flight++);
          view.moveTo(pos.x, pos.y, duration, delay, () => view.setDepth(rest));
          if (face.faceUp !== view.faceUp) {
            view.setFace(face.faceUp, ANIM.flip / this.speed, deal ? delay + duration * 0.7 : 0);
          }
        } else {
          if (!animate || moving) view.placeAt(pos.x, pos.y);
          if (!view.isMoving) view.setDepth(rest);
          if (face.faceUp !== view.faceUp) {
            view.setFace(
              face.faceUp,
              animate ? ANIM.flip / this.speed : 0,
              animate ? 110 / this.speed : 0,
            );
          }
        }
      });
    }
    this.updateStockSlot();
    this.updateControls();
  }

  private updateStockSlot(): void {
    const session = this.session;
    const slot = this.slots.get('stock');
    if (!session || !slot) return;
    const { stock, waste } = session.state;
    // Croix seulement quand des cartes restent en défausse mais que les passages sont épuisés.
    let icon: 'none' | 'recycle' | 'empty' = 'none';
    if (stock.length === 0 && waste.length > 0) {
      icon = klondike.isLegal(session.state, { type: 'recycle' }) ? 'recycle' : 'empty';
    }
    slot.setTexture(TEX.slot(icon));
  }

  private updateControls(): void {
    const session = this.session;
    if (!session) return;
    this.buttons.undo.setEnabled(session.canUndo && !this.cascading && !this.won);
    this.buttons.hint.setEnabled(!this.cascading && !this.won);
    const canFinish = !this.won && !this.cascading && klondike.canAutoComplete(session.state);
    if (canFinish !== this.finishButton.visible) {
      this.finishButton.setVisible(canFinish);
      if (canFinish) {
        this.finishButton.setScale(0.6).setAlpha(0);
        this.tweens.add({
          targets: this.finishButton,
          scale: 1,
          alpha: 1,
          duration: 240 / this.speed,
          ease: 'Back.easeOut',
        });
      }
    }
    this.refreshInfo(true);
  }

  private refreshInfo(force = false): void {
    const session = this.session;
    if (!session || !this.info) return;
    const s = app.settings;
    const parts: string[] = [];
    if (s.scoring === 'standard') parts.push(`${t('game.score')} ${session.score}`);
    parts.push(`${t('game.moves')} ${session.moveCount}`);
    if (s.showTimer) parts.push(formatTime(session.elapsedMs));
    const text = parts.join('   ·   ');
    if (force || text !== this.info.text) this.info.setText(text);
  }

  // ---------------------------------------------------------------------------
  // Entrées
  // ---------------------------------------------------------------------------

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) =>
      this.onDown(p, over),
    );
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    // Raccourcis clavier (web et tablettes avec clavier).
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.session || this.dialog || this.won || this.pointer || this.drag) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      this.undo();
    } else if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    } else if (key === 'u' || key === 'backspace') {
      this.undo();
    } else if (key === 'h') {
      void this.requestHint();
    } else if (key === ' ' || key === 'd') {
      event.preventDefault();
      this.tap({ pileId: 'stock', cardIndex: -1 });
    } else if (key === 'n') {
      this.askNewGame();
    }
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    audio.unlock();
    if (this.winFx) {
      this.winFx.skip();
      return;
    }
    if (this.cascading) {
      this.finishCascadeNow();
      return;
    }
    if (this.pointer) {
      // Un seul doigt à la fois : un second contact pendant un geste est ignoré…
      const previous = this.input.manager.pointers.find((pp) => pp.id === this.pointer?.id);
      if (previous?.isDown && previous.id !== p.id) return;
      // … mais un geste dont le relâchement a été perdu (appel, geste système) est abandonné.
      this.cancelDrag();
      this.pointer = null;
    }
    if (over.length > 0 || this.dialog || !this.session || this.won) return;
    this.clearHint();
    const hit = this.hitTest(p.x, p.y);
    const draggable = hit ? klondike.canDrag(this.session.state, hit.pileId, hit.cardIndex) : false;
    this.pointer = { id: p.id, x: p.x, y: p.y, hit, draggable };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const down = this.pointer;
    if (!down || down.id !== p.id || !p.isDown) return;
    if (this.drag) {
      this.updateDrag(p);
      return;
    }
    if (down.draggable && down.hit && Math.hypot(p.x - down.x, p.y - down.y) > 8 * this.dpr) {
      this.startDrag(down.hit);
      this.updateDrag(p);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const down = this.pointer;
    if (down && down.id !== p.id) return;
    this.pointer = null;
    if (this.drag) {
      this.endDrag();
      return;
    }
    if (!down?.hit || Math.hypot(p.x - down.x, p.y - down.y) > 14 * this.dpr) return;
    this.tap(down.hit);
  }

  /** Carte (ou emplacement vide) sous le doigt, avec des zones de toucher généreuses. */
  private hitTest(x: number, y: number): Hit | null {
    const session = this.session;
    if (!session) return null;
    const { cardW, cardH } = this.layout;
    const slack = cardW * CARD.gap * 0.5 + 2 * this.dpr;
    for (const pile of klondike.piles(session.state)) {
      const base = this.layout.piles[pile.id];
      if (!base) continue;
      const positions = cardPositions(this.layout, pile.id, pile.cards, this.drawCount);
      const n = pile.cards.length;
      if (pile.kind === 'tableau') {
        if (x < base.x - slack || x > base.x + cardW + slack) continue;
        if (n === 0) {
          if (y >= base.y - slack && y <= base.y + cardH + slack)
            return { pileId: pile.id, cardIndex: -1 };
          continue;
        }
        const last = positions[n - 1] as { y: number };
        if (y > last.y + cardH * 1.15 || y < base.y - slack) continue;
        for (let i = n - 1; i >= 0; i--) {
          if (y >= (positions[i] as { y: number }).y) return { pileId: pile.id, cardIndex: i };
        }
        return { pileId: pile.id, cardIndex: 0 };
      }
      const lastPos = positions[n - 1] ?? base;
      const right = Math.max(base.x, lastPos.x) + cardW;
      const bottom = Math.max(base.y, lastPos.y) + cardH;
      if (x >= base.x - slack && x <= right + slack && y >= base.y - slack && y <= bottom + slack) {
        return { pileId: pile.id, cardIndex: n - 1 };
      }
    }
    return null;
  }

  private tap(hit: Hit): void {
    const session = this.session;
    if (!session) return;
    const move = klondike.tapMove(session.state, hit.pileId, hit.cardIndex);
    if (move) {
      this.play(move);
      return;
    }
    this.reject(hit);
  }

  /** Aucun coup possible : petite secousse. */
  private reject(hit: Hit): void {
    const session = this.session;
    if (!session) return;
    const pile = klondike.piles(session.state).find((p) => p.id === hit.pileId);
    const amplitude = 5 * this.dpr;
    const duration = ANIM.shake / this.speed;
    if (!pile || pile.cards.length === 0 || hit.cardIndex < 0) {
      const slot = this.slots.get(hit.pileId);
      if (slot) {
        this.tweens.add({
          targets: slot,
          x: slot.x + amplitude,
          duration: duration / 6,
          yoyo: true,
          repeat: 2,
        });
      }
    } else {
      for (const face of pile.cards.slice(Math.max(0, hit.cardIndex))) {
        this.cards[face.card]?.shake(amplitude, duration);
      }
    }
    audio.play('error');
    haptics.medium();
  }

  // --- Glisser-déposer ---------------------------------------------------------

  private startDrag(hit: Hit): void {
    const session = this.session;
    if (!session) return;
    const pile = klondike.piles(session.state).find((p) => p.id === hit.pileId);
    if (!pile) return;
    const views = pile.cards.slice(hit.cardIndex).map((f) => this.cards[f.card] as CardView);
    const first = views[0];
    const down = this.pointer;
    if (!first || !down) return;
    const offsets = views.map((v) => ({
      dx: v.targetX - first.targetX,
      dy: v.targetY - first.targetY,
    }));
    views.forEach((v, k) => v.setDepth(DRAG_DEPTH + k));
    const targets = klondike.dropTargets(session.state, hit.pileId, hit.cardIndex);
    const glows = targets.map((id) => {
      const r = this.targetCardRect(id);
      const g = addGlow(this, r.x, r.y, r.w, r.h, this.speed);
      g.setAlpha(0.5);
      return g;
    });
    this.drag = {
      pileId: hit.pileId,
      cardIndex: hit.cardIndex,
      views,
      offsets,
      grabDX: down.x - first.targetX,
      grabDY: down.y - first.targetY,
      targets,
      glows,
    };
    audio.play('slide');
  }

  private updateDrag(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    const x = p.x - d.grabDX;
    const y = p.y - d.grabDY;
    d.views.forEach((v, k) => {
      const o = d.offsets[k] as { dx: number; dy: number };
      v.dragTo(x + o.dx, y + o.dy);
    });
  }

  private cancelDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    for (const g of d.glows) g.destroy();
    d.views.forEach((v, k) => {
      v.placeAt(v.targetX, v.targetY);
      v.setDepth(REST_DEPTH + d.cardIndex + k);
    });
  }

  private endDrag(): void {
    const d = this.drag;
    const session = this.session;
    this.drag = null;
    if (!d || !session) return;
    for (const g of d.glows) g.destroy();
    const first = d.views[0] as CardView;
    const target = this.pickDropTarget(d.targets, first.left, first.top);
    if (target) {
      const move = klondike.dropMove(session.state, d.pileId, d.cardIndex, target);
      if (move && this.play(move)) return;
    }
    d.views.forEach((v, k) => {
      v.moveTo(v.targetX, v.targetY, ANIM.snapBack / this.speed, 0, () =>
        v.setDepth(REST_DEPTH + d.cardIndex + k),
      );
    });
  }

  /** Carte du dessus (ou emplacement vide) d'une pile cible. */
  private targetCardRect(pileId: string): Rect {
    const session = this.session;
    const { cardW, cardH } = this.layout;
    const base = this.layout.piles[pileId] ?? { x: 0, y: 0 };
    if (!session) return { x: base.x, y: base.y, w: cardW, h: cardH };
    const pile = klondike.piles(session.state).find((p) => p.id === pileId);
    const positions = pile ? cardPositions(this.layout, pileId, pile.cards, this.drawCount) : [];
    const last = positions[positions.length - 1] ?? base;
    return { x: last.x, y: last.y, w: cardW, h: cardH };
  }

  /** Aimantation : la pile valide la plus recouverte, sinon la plus proche. */
  private pickDropTarget(targets: readonly string[], x: number, y: number): string | null {
    const { cardW, cardH } = this.layout;
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const id of targets) {
      const r = this.targetCardRect(id);
      const base = this.layout.piles[id] ?? r;
      // Pour une colonne, toute sa hauteur compte.
      const top = id.startsWith('t') ? Math.min(base.y, r.y) : r.y;
      const ox = Math.max(0, Math.min(x + cardW, r.x + r.w) - Math.max(x, r.x));
      const oy = Math.max(0, Math.min(y + cardH, r.y + r.h) - Math.max(y, top));
      const overlap = ox * oy;
      const distance = Math.hypot(x - r.x, y - r.y);
      const score = overlap > 0 ? overlap : distance < cardW * 1.1 ? -distance : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return bestScore === -Infinity ? null : best;
  }

  // ---------------------------------------------------------------------------
  // Coups
  // ---------------------------------------------------------------------------

  private play(move: KlondikeMove): boolean {
    const session = this.session;
    if (!session || this.won) return false;
    const record = session.apply(move);
    if (!record) return false;
    this.feedback(record);
    this.afterChange();
    return true;
  }

  private feedback(record: KlondikeRecord): void {
    const { move } = record;
    if (move.type === 'draw') audio.play('deal');
    else if (move.type === 'recycle') audio.play('slide');
    else if (move.to.startsWith('f')) audio.play('foundation');
    else audio.play('place');
    if (record.flipped) this.time.delayedCall(140 / this.speed, () => audio.play('flip'));
    haptics.light();
  }

  private afterChange(): void {
    const session = this.session;
    if (!session) return;
    this.version++;
    this.clearHint();
    this.sync(true);
    app.storeSession(session);
    if (session.isWon) {
      this.onWin();
      return;
    }
    this.checkBlocked();
  }

  private undo(): void {
    const session = this.session;
    if (!session || this.cascading || this.won) return;
    if (session.undo()) {
      audio.play('slide');
      this.afterChange();
    }
  }

  // --- Auto-complétion -----------------------------------------------------------

  private runAutoComplete(): void {
    const session = this.session;
    if (!session || this.cascading || this.won) return;
    const moves = klondike.autoCompleteMoves(session.state);
    if (moves.length === 0) return;
    this.cascading = true;
    session.autoCompleted = true;
    analytics.track('autocomplete_used', { moves: moves.length });
    this.cascadeQueue = [...moves];
    this.updateControls();
    const step = (): void => {
      const move = this.cascadeQueue.shift();
      if (!move) {
        this.cascadeTimer = null;
        this.cascading = false;
        this.afterChange();
        return;
      }
      const record = session.apply(move);
      if (record) {
        this.version++;
        if (move.type === 'move') audio.play('foundation');
        this.sync(true);
      }
      this.cascadeTimer = this.time.delayedCall(ANIM.cascadeStagger / this.speed, step);
    };
    step();
  }

  /** Un tap pendant la cascade la termine immédiatement. */
  private finishCascadeNow(): void {
    const session = this.session;
    if (!session) return;
    this.cascadeTimer?.remove(false);
    this.cascadeTimer = null;
    for (const move of this.cascadeQueue) session.apply(move);
    this.cascadeQueue = [];
    this.cascading = false;
    this.version++;
    this.sync(false);
    this.afterChange();
  }

  // --- Indices ---------------------------------------------------------------------

  private async requestHint(): Promise<void> {
    const session = this.session;
    if (!session || this.cascading || this.won || this.hintPending) return;
    const version = this.version;
    this.hintPending = true;
    this.buttons.hint.setBusy(true);
    const { move, source } = await app.solver.hint(klondike.cloneState(session.state));
    this.hintPending = false;
    if (!this.scene.isActive() && !this.scene.isPaused()) return;
    this.buttons.hint.setBusy(false);
    if (version !== this.version || this.session !== session) return;
    if (!move) {
      showToast(this, t('game.noHint'), this.toastY(), this.layout.unit);
      return;
    }
    session.hintCount++;
    analytics.track('hint_used', { source });
    this.showHint(move);
  }

  private toastY(): number {
    const { toolbar } = this.layout;
    return toolbar.vertical ? this.scale.height * 0.85 : toolbar.y - 40 * this.layout.unit;
  }

  private showHint(move: KlondikeMove): void {
    const session = this.session;
    if (!session) return;
    this.clearHint();
    const { cardW, cardH } = this.layout;
    const desc = klondike.describeMove(session.state, move);
    const piles = klondike.piles(session.state);
    const src = piles.find((p) => p.id === desc.from);
    if (!src) return;
    const srcPos = cardPositions(this.layout, src.id, src.cards, this.drawCount);
    let from: { x: number; y: number };
    if (move.type === 'draw' || move.type === 'recycle') {
      from = this.layout.piles.stock ?? { x: 0, y: 0 };
    } else {
      from = srcPos[desc.cardIndex] ?? { x: 0, y: 0 };
    }
    const to = move.type === 'move' ? this.targetCardRect(desc.to) : null;
    this.hintObjects.push(addGlow(this, from.x, from.y, cardW, cardH, this.speed));
    if (to) this.hintObjects.push(addGlow(this, to.x, to.y, cardW, cardH, this.speed));

    // Fantôme : la carte glisse doucement vers sa destination.
    const face = src.cards[desc.cardIndex];
    if (move.type === 'move' && face && to) {
      const dy =
        desc.to.startsWith('t') && (piles.find((p) => p.id === desc.to)?.cards.length ?? 0) > 0
          ? cardH * CARD.faceUpOffset
          : 0;
      const ghost = this.add
        .image(from.x + cardW / 2, from.y + cardH / 2, TEX.face(face.card))
        .setDepth(21_000)
        .setAlpha(0);
      this.tweens.add({
        targets: ghost,
        x: to.x + cardW / 2,
        y: to.y + dy + cardH / 2,
        alpha: { from: 0.9, to: 0.25 },
        duration: 650 / this.speed,
        delay: 150,
        repeat: 1,
        repeatDelay: 450,
        ease: 'Sine.easeInOut',
        onComplete: () => ghost.destroy(),
      });
      this.hintObjects.push(ghost);
    }
    this.hintTimer = this.time.delayedCall(4500, () => this.clearHint());
  }

  private clearHint(): void {
    for (const o of this.hintObjects) o.destroy();
    this.hintObjects = [];
    this.hintTimer?.remove(false);
    this.hintTimer = null;
  }

  // --- Blocage ----------------------------------------------------------------------

  private checkBlocked(): void {
    const session = this.session;
    if (!session || this.cascading || this.won) return;
    if (klondike.canAutoComplete(session.state)) return;
    const version = this.version;
    void app.solver.isBlocked(klondike.cloneState(session.state)).then((blocked) => {
      if (!blocked || version !== this.version || this.session !== session) return;
      if (this.blockedDismissed === version || this.dialog || this.won) return;
      this.showBlockedDialog();
    });
  }

  private showBlockedDialog(): void {
    const session = this.session;
    if (!session) return;
    const buttons: DialogButton[] = [];
    if (session.canUndo) {
      buttons.push({
        label: t('blocked.undo'),
        style: 'primary',
        icon: 'undo',
        onClick: () => this.closeDialog(() => this.undo()),
      });
    }
    buttons.push(
      {
        label: t('blocked.replay'),
        style: 'secondary',
        icon: 'replay',
        onClick: () => this.closeDialog(() => this.replay()),
      },
      {
        label: t('blocked.new'),
        style: 'secondary',
        icon: 'new',
        onClick: () => this.closeDialog(() => void this.newGame()),
      },
      {
        label: t('blocked.look'),
        style: 'secondary',
        onClick: () =>
          this.closeDialog(() => {
            this.blockedDismissed = this.version;
          }),
      },
    );
    this.openDialog(
      () =>
        new Dialog(this, {
          title: t('blocked.title'),
          body: t('blocked.body'),
          buttons,
          unit: this.layout.unit,
          onDismiss: () => this.closeDialog(() => (this.blockedDismissed = this.version)),
        }),
    );
  }

  // --- Nouvelle partie ------------------------------------------------------------------

  private askNewGame(): void {
    const session = this.session;
    if (!session || this.cascading) return;
    if (!session.hasStarted || this.won) {
      void this.newGame();
      return;
    }
    this.openDialog(
      () =>
        new Dialog(this, {
          title: t('confirm.title'),
          body: t('confirm.body'),
          unit: this.layout.unit,
          buttons: [
            {
              label: t('confirm.new'),
              style: 'primary',
              icon: 'new',
              onClick: () => this.closeDialog(() => void this.newGame()),
            },
            {
              label: t('confirm.replay'),
              style: 'secondary',
              icon: 'replay',
              onClick: () => this.closeDialog(() => this.replay()),
            },
            { label: t('confirm.cancel'), style: 'secondary', onClick: () => this.closeDialog() },
          ],
          onDismiss: () => this.closeDialog(),
        }),
    );
  }

  private async newGame(): Promise<void> {
    if (this.session) app.trackAbandon(this.session);
    const session = await app.newSession();
    this.startSession(session, true);
  }

  private replay(): void {
    const session = this.session;
    if (!session) return;
    app.replaySession(session);
    this.startSession(session, true);
  }

  // --- Victoire ----------------------------------------------------------------------------

  private onWin(): void {
    const session = this.session;
    if (!session || this.won) return;
    this.won = true;
    this.clearHint();
    const s = app.settings;
    const bonus = s.scoring === 'standard' && s.showTimer ? timeBonus(session.elapsedMs / 1000) : 0;
    const score = session.score + bonus;
    app.recordWin(session, score);
    audio.play('win');
    haptics.success();
    this.updateControls();
    this.time.delayedCall((ANIM.moveMax + 150) / this.speed, () => {
      if (!this.won || this.session !== session) return;
      this.winFx = playWinAnimation(this, this.cards, this.speed, () => {
        this.winFx = null;
        this.showWinDialog(session, score, bonus);
      });
    });
  }

  private showWinDialog(session: KlondikeSession, score: number, bonus: number): void {
    // Une nouvelle partie a pu être lancée pendant l'animation.
    if (!this.won || this.session !== session) return;
    const lines = [
      `${t('win.time')} : ${formatTime(session.elapsedMs)}`,
      `${t('win.moves')} : ${session.moveCount}`,
    ];
    if (app.settings.scoring === 'standard') {
      lines.push(`${t('win.score')} : ${score}`);
      if (bonus > 0) lines.push(t('win.bonus', { bonus }));
    }
    this.openDialog(
      () =>
        new Dialog(this, {
          title: t('win.title'),
          body: lines.join('\n'),
          unit: this.layout.unit,
          buttons: [
            {
              label: t('win.new'),
              style: 'primary',
              icon: 'new',
              onClick: () => this.closeDialog(() => void this.newGame()),
            },
            {
              label: t('win.menu'),
              style: 'secondary',
              icon: 'menu',
              onClick: () => this.closeDialog(() => this.goToMenu()),
            },
          ],
        }),
    );
  }

  // --- Dialogues et navigation ---------------------------------------------------------------

  private openDialog(builder: () => Dialog): void {
    this.dialog?.destroy();
    this.dialogBuilder = builder;
    this.dialog = builder();
  }

  private closeDialog(then?: () => void): void {
    this.dialog?.close();
    this.dialog = null;
    this.dialogBuilder = null;
    then?.();
  }

  private goToMenu(): void {
    if (this.session && !this.won) app.storeSession(this.session);
    app.persistNow();
    this.scene.start('Menu');
  }

  private openSettings(): void {
    this.cancelDrag();
    this.clearHint();
    this.scene.launch('Settings', { from: 'Game' });
    this.scene.pause();
  }

  // --- Boucle -----------------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const session = this.session;
    if (!session || this.won || this.dialog) return;
    session.tick(Math.min(delta, 1000));
    if (app.settings.showTimer) this.refreshInfo();
  }
}
