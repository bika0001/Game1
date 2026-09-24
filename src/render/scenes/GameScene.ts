import Phaser from 'phaser';
import { ANIM, CARD, CSS, PALETTE, REDUCED_MOTION_FACTOR } from '../../config/theme';
import {
  klondike,
  timeBonus,
  type KlondikeMove,
  type KlondikeRecord,
} from '../../core/games/klondike';
import type { PileSnapshot } from '../../core/games/types';
import type { DecorId, Settings } from '../../core/settings';
import { t } from '../../i18n';
import { audio } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { analytics } from '../../services/analytics';
import { app, type KlondikeSession } from '../app';
import { TEX, type CardMetrics } from '../cardart/textures';
import { createDecor, type Decor } from '../decor/decors';
import { ensureFxTextures } from '../decor/fxTextures';
import { cardTexturesFor, floorBottomFor, klondikeLayoutFor } from '../gameSetup';
import { cardPositions, type KlondikeLayout, type Rect } from '../layout/klondikeLayout';
import { CardView } from '../objects/CardView';
import {
  addGlow,
  flashSlot,
  floatText,
  FX_DEPTH,
  ripple,
  showToast,
  sparkleBurst,
  WinCelebration,
} from '../objects/Effects';
import { initialQuality, QualityMonitor } from '../quality';
import { Button, Dialog, InfoPill, type DialogButton, type DialogStat } from '../ui/widgets';
import { devicePixelRatio } from '../viewport';
import { formatTime } from '../format';

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
  readonly glows: Map<string, Phaser.GameObjects.Image>;
  pointerX: number;
  pointerY: number;
  tilt: number;
  hover: string | null;
}

/** Nature d'une mise à jour de l'affichage : elle décide du style des vols. */
type SyncKind = 'instant' | 'deal' | 'play' | 'drop' | 'undo' | 'cascade';

interface SyncOptions {
  readonly kind: SyncKind;
  /** Points gagnés ou perdus, affichés à l'arrivée sur la pile `focus`. */
  readonly scoreDelta?: number;
  readonly focus?: string;
}

interface Flight {
  readonly view: CardView;
  readonly pile: PileSnapshot;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly faceUp: boolean;
  /** Recouverte à l'arrivée par la carte suivante (pioche, fondation). */
  readonly covered: boolean;
}

type ToolbarKey = 'menu' | 'settings' | 'new' | 'hint' | 'undo';

const REST_DEPTH = 100;
const FLY_DEPTH = 10_000;
const DRAG_DEPTH = 25_000;
const RIPPLE_DEPTH = 50;
/** Fenêtre pendant laquelle des cartes posées sur les fondations forment une série (sons qui montent). */
const COMBO_WINDOW_MS = 3500;

export class GameScene extends Phaser.Scene {
  private session: KlondikeSession | null = null;
  private mode: GameMode = 'continue';
  private layout!: KlondikeLayout;
  private metrics!: CardMetrics;
  private dpr = 1;

  private decor: Decor | null = null;
  private decorId: DecorId | null = null;
  private quality!: QualityMonitor;
  private toolbarShade!: Phaser.GameObjects.Graphics;
  private readonly slots = new Map<string, Phaser.GameObjects.Image>();
  private cards: CardView[] = [];
  private pills!: { score: InfoPill; moves: InfoPill; time: InfoPill };
  private buttons!: Record<ToolbarKey, Button>;
  private finishButton!: Button;
  private finishPulse: Phaser.Tweens.Tween | null = null;

  private hintObjects: Phaser.GameObjects.GameObject[] = [];
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  private dialog: Dialog | null = null;
  private dialogBuilder: (() => Dialog) | null = null;

  /** Incrémenté à chaque changement d'état (résultats asynchrones périmés ignorés). */
  private version = 0;
  private cascading = false;
  private cascadeQueue: KlondikeMove[] = [];
  private cascadeTimer: Phaser.Time.TimerEvent | null = null;
  private celebration: WinCelebration | null = null;
  private won = false;
  private blockedDismissed = -1;
  private hintPending = false;
  private combo = 0;
  private lastFoundationAt = -Infinity;
  private pointer: {
    id: number;
    x: number;
    y: number;
    hit: Hit | null;
    draggable: boolean;
  } | null = null;
  /** Cartes légèrement soulevées sous le doigt (retour immédiat au toucher). */
  private pressed: CardView[] = [];
  private drag: DragState | null = null;
  private unsubscribe: (() => void) | null = null;
  private leaving = false;

  constructor() {
    super('Game');
  }

  init(data: { mode?: GameMode }): void {
    this.mode = data.mode ?? 'continue';
    this.session = null;
    this.won = false;
    this.cascading = false;
    this.cascadeQueue = [];
    this.celebration = null;
    this.dialog = null;
    this.dialogBuilder = null;
    this.drag = null;
    this.pointer = null;
    this.pressed = [];
    this.hintPending = false;
    this.hintObjects = [];
    this.cards = [];
    this.slots.clear();
    this.decor = null;
    this.decorId = null;
    this.combo = 0;
    this.lastFoundationAt = -Infinity;
    this.leaving = false;
    this.finishPulse = null;
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
    ensureFxTextures(this, this.dpr);
    this.quality = new QualityMonitor(
      (level) => this.decor?.setQuality(level),
      app.settings.reducedMotion ? 0 : 2,
      initialQuality(),
    );
    this.buildDecor();
    this.toolbarShade = this.add.graphics().setDepth(5);

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

    const u = this.layout.unit;
    this.pills = {
      score: new InfoPill(this, 'star', u).setDepth(6),
      moves: new InfoPill(this, 'moves', u).setDepth(6),
      time: new InfoPill(this, 'clock', u).setDepth(6),
    };

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
      this.decor?.destroy();
      this.decor = null;
      app.setActiveSession(null);
    });

    this.cameras.main.fadeIn(320, 6, 32, 43);
    void this.loadSession();
  }

  private computeLayout(): void {
    this.layout = klondikeLayoutFor(this, this.dpr, this.drawCount);
    this.metrics = cardTexturesFor(this, this.layout);
  }

  /** Crée (ou redessine à la bonne taille) le décor choisi dans les réglages. */
  private buildDecor(): void {
    const id = app.settings.decor;
    if (!this.decor || this.decorId !== id) {
      this.decor?.destroy();
      this.decor = createDecor(this, id);
      this.decorId = id;
    }
    this.decor.build({
      width: this.scale.width,
      height: this.scale.height,
      dpr: this.dpr,
      floorBottom: floorBottomFor(this, this.layout, this.dpr),
    });
    this.decor.setQuality(this.quality.current);
  }

  private buildButtons(): void {
    const u = this.layout.unit;
    const make = (icon: ToolbarKey, label: string, onClick: () => void, accent = false) =>
      new Button(this, 0, 0, {
        width: 80 * u,
        height: 70 * u,
        label,
        icon,
        style: accent ? 'toolbarAccent' : 'toolbar',
        unit: u,
        onClick,
      }).setDepth(7);
    this.buttons = {
      menu: make('menu', t('game.menu'), () => this.goToMenu()),
      settings: make('settings', t('game.settings'), () => this.openSettings()),
      new: make('new', t('game.new'), () => this.askNewGame()),
      hint: make('hint', t('game.hint'), () => void this.requestHint()),
      undo: make('undo', t('game.undo'), () => this.undo(), true),
    };
    this.finishButton = new Button(this, 0, 0, {
      width: 190 * u,
      height: 58 * u,
      label: t('game.finish'),
      icon: 'finish',
      style: 'accent',
      unit: u,
      onClick: () => this.runAutoComplete(),
    })
      // Au-dessus des cartes posées (une longue colonne peut passer dessous), sous les cartes en vol.
      .setDepth(FLY_DEPTH - 1)
      .setVisible(false);
    this.finishPulse = null;
  }

  private rebuildButtons(): void {
    for (const b of Object.values(this.buttons)) b.destroy();
    this.finishPulse?.stop();
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
    this.slots.get('waste')?.setAlpha(0.6);

    const { toolbar, unit: u } = this.layout;
    const W = this.scale.width;
    const H = this.scale.height;
    // Voile dégradé sous la barre d'outils : les libellés restent lisibles sur le décor.
    this.toolbarShade.clear();
    const deep = PALETTE.deep;
    if (toolbar.vertical) {
      const fade = 36 * u;
      const onLeft = toolbar.x < W / 2;
      const x = onLeft ? 0 : toolbar.x - fade;
      const w = onLeft ? toolbar.x + toolbar.w + fade : W - x;
      const a0 = onLeft ? 0.5 : 0;
      const a1 = onLeft ? 0 : 0.5;
      this.toolbarShade.fillGradientStyle(deep, deep, deep, deep, a0, a1, a0, a1);
      this.toolbarShade.fillRect(x, 0, w, H);
    } else {
      const top = toolbar.y - 28 * u;
      this.toolbarShade.fillGradientStyle(deep, deep, deep, deep, 0, 0, 0.55, 0.55);
      this.toolbarShade.fillRect(0, top, W, H - top);
    }

    const order: ToolbarKey[] = ['menu', 'settings', 'new', 'hint', 'undo'];
    if (app.settings.leftHanded && !toolbar.vertical) order.reverse();
    if (toolbar.vertical) {
      const span = Math.min(toolbar.h - 24 * u, order.length * 100 * u);
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
    this.finishButton.setPosition(fb.x + fb.w / 2, fb.y + fb.h / 2).resize(fb.w, fb.h + 6 * u);

    for (const pill of Object.values(this.pills)) pill.setUnit(u);
    this.refreshInfo(true);
  }

  /** Recalcule la mise en page et met à jour tout l'affichage (taille des cartes comprise). */
  private relayout(): void {
    this.computeLayout();
    ensureFxTextures(this, this.dpr);
    for (const view of this.cards) view.setMetrics(this.metrics);
    for (const slot of this.slots.values()) slot.setTexture(slot.texture.key);
    this.buildDecor();
    this.rebuildButtons();
    this.layoutAll();
  }

  private onResize(): void {
    this.dpr = devicePixelRatio();
    this.cancelDrag();
    this.releasePress();
    this.clearHint();
    this.relayout();
    this.celebration?.skip();
    this.sync({ kind: 'instant' });
    if (this.dialogBuilder) {
      this.dialog?.destroy();
      this.dialog = this.dialogBuilder();
    }
  }

  private onSettingsChanged(settings: Settings, changed: ReadonlyArray<keyof Settings>): void {
    if (changed.some((k) => k === 'leftHanded' || k === 'locale')) {
      this.relayout();
      this.sync({ kind: 'instant' });
    } else if (changed.includes('decor')) {
      this.buildDecor();
    }
    if (changed.includes('reducedMotion')) {
      this.quality.setMax(settings.reducedMotion ? 0 : 2);
    }
    if (changed.some((k) => k === 'scoring' || k === 'showTimer')) this.refreshInfo(true);
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
    this.combo = 0;
    this.closeDialog();
    this.clearHint();
    this.celebration?.skip();
    this.celebration = null;
    // La place réservée à l'éventail de la défausse dépend du mode de pioche.
    this.relayout();
    const stock = this.layout.piles.stock;
    for (const view of this.cards) {
      view.resetAppearance();
      view.setVisible(true);
      if (deal && stock) {
        view.setFace(false);
        view.placeAt(stock.x, stock.y);
        view.setDepth(REST_DEPTH);
      }
    }
    if (deal) {
      audio.play('whoosh');
      this.sync({ kind: 'deal' });
    } else {
      this.sync({ kind: 'instant' });
      this.checkBlocked();
    }
  }

  // ---------------------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------------------

  private moveDuration(distance: number): number {
    const base = ANIM.move * (0.7 + distance / (this.layout.cardH * 6));
    return Math.min(ANIM.moveMax, base) / this.speed;
  }

  /** Ordre de distribution : rangée par rangée, de gauche à droite, comme à la main. */
  private dealDelay(pile: PileSnapshot, index: number): number {
    if (pile.kind !== 'tableau') return 0;
    let order = 0;
    for (let r = 0; r < index; r++) order += 7 - r;
    order += pile.index - index;
    return (order * ANIM.dealStagger) / this.speed;
  }

  /** Aligne chaque carte sur l'état du jeu, avec des vols animés selon la nature du changement. */
  private sync(opts: SyncOptions): void {
    const session = this.session;
    if (!session) return;
    const animate = opts.kind !== 'instant';
    const flights: Flight[] = [];
    for (const pile of klondike.piles(session.state)) {
      const positions = cardPositions(this.layout, pile.id, pile.cards, this.drawCount);
      pile.cards.forEach((face, i) => {
        const view = this.cards[face.card] as CardView;
        const pos = positions[i] as { x: number; y: number };
        const next = positions[i + 1];
        const covered = !!next && next.x === pos.x && next.y === pos.y;
        const moving = !view.isMovingTo(pos.x, pos.y);
        if (animate && moving) {
          flights.push({ view, pile, index: i, x: pos.x, y: pos.y, faceUp: face.faceUp, covered });
          return;
        }
        view.setCovered(covered);
        if (!animate || moving) view.placeAt(pos.x, pos.y);
        if (!view.isMoving) view.setDepth(REST_DEPTH + i);
        if (face.faceUp !== view.faceUp) {
          const delay = animate ? 120 / this.speed : 0;
          view.setFace(face.faceUp, animate ? ANIM.flip / this.speed : 0, delay);
          if (animate && face.faceUp) this.onReveal(view, delay);
        }
      });
    }
    this.launch(flights, opts);
    this.updateStockSlot();
    this.updateControls();
  }

  /** Lance les vols : arcs, échelonnement des piles, retournements et effets à l'arrivée. */
  private launch(flights: readonly Flight[], opts: SyncOptions): void {
    if (flights.length === 0) {
      if (opts.scoreDelta && opts.focus) this.showScore(opts.scoreDelta, opts.focus);
      return;
    }
    const speed = this.speed;
    const { cardH } = this.layout;
    const first = new Map<string, number>();
    for (const f of flights) {
      first.set(f.pile.id, Math.min(first.get(f.pile.id) ?? Infinity, f.index));
    }
    let order = 0;
    let scoreShown = false;
    for (const f of flights) {
      const { view, pile } = f;
      const k = f.index - (first.get(pile.id) ?? f.index);
      const dist = Math.hypot(f.x - view.left, f.y - view.top);
      let duration = this.moveDuration(dist);
      let delay = (k * 28) / speed;
      let arc: number | undefined;
      let lift: number | undefined;
      let tilt: number | undefined;
      switch (opts.kind) {
        case 'deal':
          duration = ANIM.deal / speed;
          delay = this.dealDelay(pile, f.index);
          lift = 0.75;
          tilt = 10;
          break;
        case 'drop':
          duration = (ANIM.drop / speed) * (1 + Math.min(1, dist / (cardH * 3)));
          delay = (k * 12) / speed;
          arc = 0;
          lift = 0.05;
          break;
        case 'cascade':
          lift = 1;
          arc = Math.min(dist * 0.25, cardH * 0.8);
          tilt = 12;
          break;
        case 'undo':
          delay = (k * 18) / speed;
          lift = 0.6;
          break;
        default:
          if (pile.id === 'stock') {
            // Défausse remise dans la pioche : un flot rapide de cartes.
            delay = (k * 9) / speed;
            duration = Math.min(duration, 300 / speed);
            arc = cardH * 0.25;
          }
      }
      const lead = k === 0;
      const scoreHere = !scoreShown && lead && opts.focus === pile.id && !!opts.scoreDelta;
      if (scoreHere) scoreShown = true;
      view.setDepth(FLY_DEPTH + order++);
      view.flyTo(f.x, f.y, {
        duration,
        delay,
        arc,
        lift,
        tilt,
        onStart: () => {
          if (opts.kind === 'deal') {
            audio.play('deal', { volume: 0.55, pitch: 0.9 + Math.random() * 0.25 });
          } else if (lead && dist > cardH * 1.4 && opts.kind !== 'drop') {
            audio.play('whoosh', { volume: 0.5, pitch: 0.9 + Math.random() * 0.2 });
          }
        },
        onLand: () => {
          view.setDepth(REST_DEPTH + f.index);
          if (lead) this.onLand(view, pile, opts);
          if (scoreHere) this.showScore(opts.scoreDelta ?? 0, pile.id, view);
        },
      });
      view.setCovered(f.covered);
      if (f.faceUp !== view.faceUp) {
        // Pioche : la carte se retourne en vol. Donne : juste avant de se poser.
        const flipDelay = opts.kind === 'deal' ? delay + duration * 0.62 : delay;
        view.setFace(f.faceUp, Math.min(ANIM.flip / speed, duration * 0.9), flipDelay);
      }
    }
    if (!scoreShown && opts.scoreDelta && opts.focus) this.showScore(opts.scoreDelta, opts.focus);
  }

  /** Effets à l'arrivée d'une carte (ou de la première carte d'une pile déplacée). */
  private onLand(view: CardView, pile: PileSnapshot, opts: SyncOptions): void {
    if (opts.kind === 'deal' || opts.kind === 'instant') return;
    const level = this.quality.current;
    const cx = view.x;
    const cy = view.y;
    if (pile.kind === 'foundation' && opts.kind !== 'undo') {
      const now = this.time.now;
      this.combo = now - this.lastFoundationAt < COMBO_WINDOW_MS ? Math.min(this.combo + 1, 12) : 0;
      this.lastFoundationAt = now;
      const pitch = Math.pow(2, this.combo / 12);
      audio.play('foundation', { pitch });
      audio.play('sparkle', { pitch, volume: 0.8 });
      const base = this.layout.piles[pile.id];
      if (base) {
        flashSlot(
          this,
          base.x,
          base.y,
          this.layout.cardW,
          this.layout.cardH,
          FX_DEPTH - 1,
          this.speed,
        );
      }
      sparkleBurst(this, cx, cy, {
        count: level >= 2 ? 18 : level === 1 ? 10 : 5,
        radius: this.layout.cardW * 0.9,
        depth: FX_DEPTH,
        gold: true,
      });
      return;
    }
    if (pile.kind === 'tableau') {
      audio.play('place', { pitch: 0.95 + Math.random() * 0.1 });
      if (level >= 1 && opts.kind !== 'undo') {
        ripple(this, cx, cy, this.layout.cardW * 1.9, RIPPLE_DEPTH, this.speed, 0.42);
      }
      return;
    }
    if (pile.id === 'waste' && opts.kind === 'undo') audio.play('place', { volume: 0.6 });
  }

  /** Une carte cachée du tableau se retourne : petit éclat. */
  private onReveal(view: CardView, delay: number): void {
    this.time.delayedCall(delay, () => {
      audio.play('flip');
      if (this.quality.current >= 1) {
        this.time.delayedCall(ANIM.flip / this.speed / 2, () =>
          sparkleBurst(this, view.x, view.y, {
            count: 6,
            radius: this.layout.cardW * 0.6,
            depth: FX_DEPTH,
          }),
        );
      }
    });
  }

  /** Points gagnés (doré) ou perdus (corail) qui s'envolent de la pile concernée. */
  private showScore(delta: number, pileId: string, view?: CardView): void {
    if (delta === 0 || app.settings.scoring !== 'standard') return;
    const { cardW, cardH, unit } = this.layout;
    const base = this.layout.piles[pileId];
    const x = view ? view.x : base ? base.x + cardW / 2 : this.scale.width / 2;
    const y = view ? view.y - cardH * 0.25 : base ? base.y + cardH * 0.25 : this.scale.height / 2;
    floatText(this, x, y, `${delta > 0 ? '+' : ''}${delta}`, {
      color: delta > 0 ? CSS.gold : CSS.coral,
      size: 26 * unit,
      depth: FX_DEPTH + 1,
      unit,
      speed: this.speed,
    });
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
    if (slot.texture.key !== TEX.slot(icon)) slot.setTexture(TEX.slot(icon));
  }

  private updateControls(): void {
    const session = this.session;
    if (!session) return;
    this.buttons.undo.setEnabled(session.canUndo && !this.cascading && !this.won);
    this.buttons.hint.setEnabled(!this.cascading && !this.won);
    const canFinish = !this.won && !this.cascading && klondike.canAutoComplete(session.state);
    if (canFinish !== this.finishButton.visible) {
      this.finishButton.setVisible(canFinish);
      this.finishPulse?.stop();
      this.finishPulse = null;
      if (canFinish) {
        this.finishButton.setAlpha(1).bounce();
        audio.play('pop', { pitch: 1.2 });
        // Le bouton « respire » doucement pour être remarqué.
        this.finishPulse = this.tweens.add({
          targets: this.finishButton,
          scale: 1.06,
          duration: 700,
          delay: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    this.refreshInfo();
  }

  private refreshInfo(force = false): void {
    const session = this.session;
    if (!session || !this.pills) return;
    const s = app.settings;
    const { score, moves, time } = this.pills;
    const before = [score.value, moves.value, time.value].join('|');
    score.setVisible(s.scoring === 'standard');
    time.setVisible(s.showTimer);
    score.setValue(`${t('game.score')} ${session.score}`, !force);
    moves.setValue(`${t('game.moves')} ${session.moveCount}`, !force);
    if (s.showTimer) time.setValue(formatTime(session.elapsedMs));
    const after = [score.value, moves.value, time.value].join('|');
    if (force || before !== after) this.layoutPills();
  }

  private layoutPills(): void {
    const { infoBar, unit: u } = this.layout;
    const visible = Object.values(this.pills).filter((p) => p.visible);
    const gap = 10 * u;
    const total = visible.reduce((sum, p) => sum + p.pillWidth, 0) + gap * (visible.length - 1);
    let x = infoBar.x + infoBar.w / 2 - total / 2;
    const y = infoBar.y + infoBar.h / 2;
    for (const pill of visible) {
      pill.setPosition(x + pill.pillWidth / 2, y);
      x += pill.pillWidth + gap;
    }
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
    if (this.celebration) {
      this.celebration.skip();
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
      this.releasePress();
      this.pointer = null;
    }
    if (over.length > 0 || this.dialog || !this.session || this.won || this.leaving) return;
    this.clearHint();
    const hit = this.hitTest(p.x, p.y);
    const draggable = hit ? klondike.canDrag(this.session.state, hit.pileId, hit.cardIndex) : false;
    this.pointer = { id: p.id, x: p.x, y: p.y, hit, draggable };
    this.press(hit, draggable);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const down = this.pointer;
    if (!down || down.id !== p.id || !p.isDown) return;
    if (this.drag) {
      this.drag.pointerX = p.x;
      this.drag.pointerY = p.y;
      return;
    }
    if (down.draggable && down.hit && Math.hypot(p.x - down.x, p.y - down.y) > 8 * this.dpr) {
      this.startDrag(down.hit);
      if (this.drag) {
        const d = this.drag as DragState;
        d.pointerX = p.x;
        d.pointerY = p.y;
      }
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
    if (down?.hit && Math.hypot(p.x - down.x, p.y - down.y) <= 14 * this.dpr) this.tap(down.hit);
    this.releasePress();
  }

  /** Retour immédiat au toucher : la carte (ou la pile) touchée se soulève un peu. */
  private press(hit: Hit | null, draggable: boolean): void {
    this.releasePress();
    const session = this.session;
    if (!hit || !session) return;
    const pile = klondike.piles(session.state).find((pp) => pp.id === hit.pileId);
    if (!pile || pile.cards.length === 0) return;
    let views: CardView[] = [];
    if (draggable) {
      views = pile.cards.slice(hit.cardIndex).map((f) => this.cards[f.card] as CardView);
    } else if (hit.pileId === 'stock') {
      const top = pile.cards[pile.cards.length - 1];
      if (top) views = [this.cards[top.card] as CardView];
    }
    this.pressed = views.filter((v) => !v.isMoving);
    for (const v of this.pressed) v.liftTo(0.3, 90 / this.speed);
  }

  private releasePress(): void {
    for (const v of this.pressed) if (!v.isMoving) v.liftTo(0, 150 / this.speed);
    this.pressed = [];
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
    this.releasePress();
    const pile = klondike.piles(session.state).find((p) => p.id === hit.pileId);
    const amplitude = 6 * this.dpr;
    const duration = ANIM.shake / this.speed;
    if (!pile || pile.cards.length === 0 || hit.cardIndex < 0) {
      const slot = this.slots.get(hit.pileId);
      if (slot) {
        const x = slot.x;
        this.tweens.add({
          targets: slot,
          x: x + amplitude,
          duration: duration / 6,
          yoyo: true,
          repeat: 2,
          onComplete: () => slot.setX(x),
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
    this.pressed = [];
    // La carte dessous redevient visible dès qu'on soulève celle du dessus.
    const below = pile.cards[hit.cardIndex - 1];
    if (below) this.cards[below.card]?.setCovered(false);
    const offsets = views.map((v) => ({
      dx: v.targetX - first.targetX,
      dy: v.targetY - first.targetY,
    }));
    views.forEach((v, k) => {
      v.setDepth(DRAG_DEPTH + k);
      v.liftTo(1, 140 / this.speed);
    });
    const targets = klondike.dropTargets(session.state, hit.pileId, hit.cardIndex);
    const glows = new Map<string, Phaser.GameObjects.Image>();
    for (const id of targets) {
      const r = this.targetCardRect(id);
      const glow = this.add
        .image(r.x + r.w / 2, r.y + r.h / 2, TEX.glow)
        .setDepth(20_000)
        .setAlpha(0);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 160 });
      glows.set(id, glow);
    }
    this.drag = {
      pileId: hit.pileId,
      cardIndex: hit.cardIndex,
      views,
      offsets,
      grabDX: down.x - first.targetX,
      grabDY: down.y - first.targetY,
      targets,
      glows,
      pointerX: down.x,
      pointerY: down.y,
      tilt: 0,
      hover: null,
    };
    audio.play('slide');
  }

  /**
   * Suivi du doigt à chaque image : la carte saisie suit presque instantanément,
   * les suivantes avec un léger retard (effet de guirlande) et le paquet
   * s'incline selon la vitesse. La pile visée s'illumine.
   */
  private stepDrag(delta: number): void {
    const d = this.drag;
    if (!d) return;
    const dt = Phaser.Math.Clamp(delta, 1, 50);
    const gx = d.pointerX - d.grabDX;
    const gy = d.pointerY - d.grabDY;
    const first = d.views[0] as CardView;
    const prevX = first.left;
    d.views.forEach((v, k) => {
      const o = d.offsets[k] as { dx: number; dy: number };
      const a = 1 - Math.exp(-dt / (10 + k * 30));
      const x = v.left + (gx + o.dx - v.left) * a;
      const y = v.top + (gy + o.dy - v.top) * a;
      v.dragTo(x, y, d.tilt * (1 + k * 0.1));
    });
    const vx = (first.left - prevX) / dt / this.dpr;
    const goal = this.speed > 1 ? 0 : Phaser.Math.Clamp(vx * 7, -10, 10);
    d.tilt += (goal - d.tilt) * (1 - Math.exp(-dt / 70));
    const hover = this.pickDropTarget(d.targets, gx, gy);
    if (hover !== d.hover) {
      d.hover = hover;
      for (const [id, glow] of d.glows) {
        this.tweens.add({
          targets: glow,
          alpha: id === hover ? 1 : 0.4,
          scale: id === hover ? 1.05 : 1,
          duration: 120,
        });
      }
    }
  }

  private destroyGlows(d: DragState): void {
    for (const glow of d.glows.values()) {
      this.tweens.add({
        targets: glow,
        alpha: 0,
        duration: 140,
        onComplete: () => glow.destroy(),
      });
    }
  }

  private cancelDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.destroyGlows(d);
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
    this.destroyGlows(d);
    const target = this.pickDropTarget(d.targets, d.pointerX - d.grabDX, d.pointerY - d.grabDY);
    if (target) {
      const move = klondike.dropMove(session.state, d.pileId, d.cardIndex, target);
      if (move && this.play(move, 'drop')) return;
    }
    audio.play('slide', { pitch: 0.8, volume: 0.7 });
    d.views.forEach((v, k) => {
      v.flyTo(v.targetX, v.targetY, {
        duration: ANIM.snapBack / this.speed,
        delay: (k * 14) / this.speed,
        arc: 0,
        lift: 0.1,
        onLand: () => v.setDepth(REST_DEPTH + d.cardIndex + k),
      });
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

  private play(move: KlondikeMove, kind: 'play' | 'drop' = 'play'): boolean {
    const session = this.session;
    if (!session || this.won) return false;
    const before = session.score;
    const record = session.apply(move);
    if (!record) return false;
    this.feedback(record);
    const focus = move.type === 'move' ? move.to : 'stock';
    this.afterChange({ kind, scoreDelta: session.score - before, focus });
    return true;
  }

  private feedback(record: KlondikeRecord): void {
    const { move } = record;
    if (move.type === 'draw') audio.play('flip', { pitch: 0.9 });
    else if (move.type === 'recycle') audio.play('slide');
    haptics.light();
  }

  private afterChange(opts: SyncOptions): void {
    const session = this.session;
    if (!session) return;
    this.version++;
    this.clearHint();
    this.sync(opts);
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
      audio.play('whoosh', { pitch: 0.8, volume: 0.6 });
      this.combo = 0;
      this.afterChange({ kind: 'undo' });
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
    this.combo = 0;
    this.lastFoundationAt = this.time.now;
    this.updateControls();
    let index = 0;
    const step = (): void => {
      const move = this.cascadeQueue.shift();
      if (!move) {
        this.cascadeTimer = null;
        this.cascading = false;
        this.afterChange({ kind: 'play' });
        return;
      }
      if (session.apply(move)) {
        this.version++;
        // Pas de « +10 » à chaque carte : le compteur de score suffit pendant la cascade.
        this.sync({ kind: 'cascade' });
      }
      // La cascade accélère (de 110 à 45 ms entre deux cartes) : un final enlevé.
      const delay = Math.max(45, 110 * Math.pow(0.94, index++)) / this.speed;
      this.cascadeTimer = this.time.delayedCall(delay, step);
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
    this.sync({ kind: 'instant' });
    this.afterChange({ kind: 'play' });
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
    audio.play('sparkle', { pitch: 0.8, volume: 0.6 });
    this.showHint(move);
  }

  private toastY(): number {
    const { toolbar } = this.layout;
    return toolbar.vertical ? this.scale.height * 0.85 : toolbar.y - 44 * this.layout.unit;
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
        duration: 700 / this.speed,
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
      // On laisse les cartes se poser avant d'annoncer le blocage.
      this.time.delayedCall(ANIM.moveMax / this.speed, () => {
        if (version !== this.version || this.dialog || this.won) return;
        this.showBlockedDialog();
      });
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
    haptics.success();
    this.updateControls();
    this.time.delayedCall((ANIM.moveMax + 200) / this.speed, () => {
      if (!this.won || this.session !== session) return;
      audio.play('win');
      this.celebration = new WinCelebration(this, {
        cards: this.cards,
        title: t('win.title'),
        skipLabel: t('win.skip'),
        skipY: this.toastY(),
        unit: this.layout.unit,
        speed: this.speed,
        quality: this.quality.current,
        onDone: () => {
          this.celebration = null;
          this.showWinDialog(session, score, bonus);
        },
      });
    });
  }

  private showWinDialog(session: KlondikeSession, score: number, bonus: number): void {
    // Une nouvelle partie a pu être lancée pendant l'animation.
    if (!this.won || this.session !== session) return;
    const stats: DialogStat[] = [
      {
        label: t('win.time'),
        value: session.elapsedMs,
        format: (v) => formatTime(v),
      },
      { label: t('win.moves'), value: session.moveCount },
    ];
    if (app.settings.scoring === 'standard') stats.push({ label: t('win.score'), value: score });
    this.openDialog(
      () =>
        new Dialog(this, {
          title: t('win.title'),
          subtitle: t('win.subtitle'),
          body: bonus > 0 ? t('win.bonus', { bonus }) : undefined,
          stats,
          celebrate: true,
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
    if (this.leaving) return;
    this.leaving = true;
    this.cancelDrag();
    if (this.session && !this.won) app.storeSession(this.session);
    app.persistNow();
    this.cameras.main.fadeOut(220, 6, 32, 43);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Menu'),
    );
  }

  private openSettings(): void {
    this.cancelDrag();
    this.releasePress();
    this.clearHint();
    this.scene.launch('Settings', { from: 'Game' });
    this.scene.pause();
  }

  // --- Boucle -----------------------------------------------------------------------------------

  override update(time: number, delta: number): void {
    this.quality.sample(delta);
    this.decor?.update(time, delta);
    this.stepDrag(delta);
    const session = this.session;
    if (!session || this.won || this.dialog) return;
    session.tick(Math.min(delta, 1000));
    if (app.settings.showTimer) this.refreshInfo();
  }
}
