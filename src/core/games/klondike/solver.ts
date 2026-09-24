import { DECK_SIZE, type Card } from '../../cards';
import {
  applyMove,
  cloneState,
  foundationFor,
  foundationId,
  foundationOfSuit,
  isWon,
  maxRecycles,
  moveOf,
  tableauId,
  topOf,
  DRAW,
  RECYCLE,
  type KlondikeMove,
  type KlondikeState,
} from './rules';

/**
 * Solveur Klondike « clairvoyant » (il connaît les cartes cachées).
 *
 * - Recherche en profondeur d'abord avec ordre heuristique des coups.
 * - Table de transposition (hachage 64 bits, insensible à l'ordre des colonnes).
 * - Coups « sûrs » vers les fondations appliqués automatiquement.
 * - Macro-coups de pioche : toute carte atteignable en piochant (et en
 *   retournant la défausse si permis) est jouable directement ; les pioches
 *   sont réinsérées lors de la reconstruction de la solution.
 * - Limites de nœuds et de temps configurables.
 *
 * La solution renvoyée est une suite de coups atomiques rejouée et vérifiée
 * avec `rules.ts` : elle est garantie légale et gagnante.
 */

export interface SolverOptions {
  /** Nombre maximal de positions explorées (défaut : 250 000). */
  readonly maxNodes?: number;
  /** Temps maximal en millisecondes (défaut : illimité). */
  readonly maxTimeMs?: number;
  /** Horloge injectable (tests). */
  readonly now?: () => number;
  /** Plan de redémarrages : part du budget et bruit sur l'ordre des coups. */
  readonly restarts?: readonly RestartStep[];
}

export interface RestartStep {
  /** Part du budget de nœuds (le dernier essai reçoit le reste). */
  readonly share: number;
  /** Bruit ajouté aux priorités des coups (0 = heuristique pure). */
  readonly noise: number;
}

/**
 * Plan par défaut : 40 recherches courtes. La première suit l'ordre heuristique,
 * les suivantes le perturbent fortement : la recherche en profondeur a une
 * « longue traîne » et les redémarrages l'évitent (mesuré : +10 points de donnes résolues).
 */
export const DEFAULT_RESTARTS: readonly RestartStep[] = Array.from({ length: 40 }, (_, i) => ({
  share: 1 / 40,
  noise: i === 0 ? 0 : 150,
}));

export type SolveStatus = 'solved' | 'unsolved' | 'limit';

export interface SolveResult {
  readonly status: SolveStatus;
  /** Coups atomiques, légaux et gagnants (vide si non résolu). */
  readonly moves: KlondikeMove[];
  /** Positions explorées. */
  readonly nodes: number;
  /** Passages dans la pioche utilisés par la solution (1 + retournements). */
  readonly passes: number;
}

const COLS = 7;
const CAP = 20; // 6 cartes cachées + 13 visibles au maximum
const TALON_CAP = 24;

// Macro-coups encodés sur 31 bits.
const K_TAB_FOUND = 0;
const K_TAB_TAB = 1;
const K_TALON_FOUND = 2;
const K_TALON_TAB = 3;
const K_FOUND_TAB = 4;

// Priorités (8 bits) : l'entier encodé se trie directement par priorité.
const P_TAB_FOUND = 200;
const P_TAB_FOUND_REVEAL = 230;
const P_TALON_FOUND = 190;
const P_REVEAL = 150; // + nombre de cartes cachées
const P_KING_REVEAL = 140; // + nombre de cartes cachées
const P_TALON_TAB = 110;
const P_TALON_KING = 100;
const P_EMPTY_FOR_KING = 80;
const P_PARTIAL = 60;
const P_FOUND_TAB = 40;

function encode(
  kind: number,
  src: number,
  dst: number,
  count: number,
  card: number,
  recycle: number,
  priority: number,
): number {
  return (
    kind |
    (src << 3) |
    (dst << 8) |
    (count << 11) |
    (card << 16) |
    (recycle << 22) |
    (Math.min(255, priority) << 23)
  );
}

const kindOf = (m: number): number => m & 7;
const srcOf = (m: number): number => (m >> 3) & 31;
const dstOf = (m: number): number => (m >> 8) & 7;
const countOf = (m: number): number => (m >> 11) & 31;
const cardOf = (m: number): number => (m >> 16) & 63;
const recycleOf = (m: number): number => (m >> 22) & 1;

const rank = (c: number): number => (c >> 2) + 1;
const suit = (c: number): number => c & 3;

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h;
}

/** Ensemble de clés 64 bits (deux entiers 32 bits), adressage ouvert. */
class HashSet64 {
  private hi: Int32Array;
  private lo: Int32Array;
  private used: Uint8Array;
  private mask: number;
  private count = 0;

  constructor(capacityPow2 = 16) {
    this.hi = new Int32Array(1 << capacityPow2);
    this.lo = new Int32Array(1 << capacityPow2);
    this.used = new Uint8Array(1 << capacityPow2);
    this.mask = (1 << capacityPow2) - 1;
  }

  /** Ajoute la clé ; renvoie false si elle était déjà présente. */
  add(h1: number, h2: number): boolean {
    let i = h1 & this.mask;
    while (this.used[i]) {
      if (this.hi[i] === h1 && this.lo[i] === h2) return false;
      i = (i + 1) & this.mask;
    }
    this.used[i] = 1;
    this.hi[i] = h1;
    this.lo[i] = h2;
    if (++this.count * 2 > this.mask) this.grow();
    return true;
  }

  private grow(): void {
    const { hi, lo, used } = this;
    const size = hi.length * 2;
    this.hi = new Int32Array(size);
    this.lo = new Int32Array(size);
    this.used = new Uint8Array(size);
    this.mask = size - 1;
    for (let j = 0; j < hi.length; j++) {
      if (!used[j]) continue;
      let i = (hi[j] as number) & this.mask;
      while (this.used[i]) i = (i + 1) & this.mask;
      this.used[i] = 1;
      this.hi[i] = hi[j] as number;
      this.lo[i] = lo[j] as number;
    }
  }
}

class Search {
  // Tableau : colonne c occupe tab[c*CAP .. c*CAP + len[c]).
  readonly tab = new Uint8Array(COLS * CAP);
  readonly len = new Uint8Array(COLS);
  readonly down = new Uint8Array(COLS);
  /** Rang au sommet de chaque fondation, par enseigne (0 = vide). */
  readonly found = new Uint8Array(4);
  foundTotal = 0;
  /** Pioche + défausse dans l'ordre de distribution ; les `tpos` premières sont dans la défausse. */
  readonly talon = new Uint8Array(TALON_CAP);
  tlen = 0;
  tpos = 0;
  recycles = 0;

  readonly drawCount: number;
  readonly maxRecycles: number;
  readonly limitedPasses: boolean;
  /**
   * En pioche 1 avec passages illimités, toute carte de la pioche reste
   * atteignable quelle que soit la position : celle-ci n'entre pas dans le hachage.
   */
  readonly positionMatters: boolean;

  // Recherche
  nodes = 0;
  aborted = false;
  /** Amplitude du bruit ajouté aux priorités (0 = ordre heuristique pur). */
  noise = 0;
  private rngState = 0x9e3779b9;
  private tt = new HashSet64();
  private readonly moveBuf = new Int32Array(1 << 16);
  private msp = 0;
  /** Chemin courant (macro-coups, y compris les coups sûrs automatiques). */
  readonly path: number[] = [];
  /** Données d'annulation parallèles au chemin : retournement, tpos et retournements de pioche. */
  private readonly undoFlip: number[] = [];
  private readonly undoTpos: number[] = [];
  private readonly undoRecycles: number[] = [];

  // Tampons de calcul de l'atteignabilité de la pioche.
  private readonly reachIdx = new Int8Array(TALON_CAP * 2);
  private readonly reachRecycle = new Int8Array(TALON_CAP * 2);
  private readonly reachSeen = new Uint8Array(TALON_CAP);
  private reachCount = 0;

  constructor(
    state: KlondikeState,
    public maxNodes: number,
    private readonly deadline: number,
    private readonly now: () => number,
  ) {
    state.tableau.forEach((col, c) => {
      this.len[c] = col.cards.length;
      this.down[c] = col.faceDown;
      col.cards.forEach((card, k) => {
        this.tab[c * CAP + k] = card;
      });
    });
    for (const pile of state.foundations) {
      const bottom = pile[0];
      if (bottom === undefined) continue;
      this.found[suit(bottom)] = pile.length;
      this.foundTotal += pile.length;
    }
    const order = [...state.waste, ...[...state.stock].reverse()];
    order.forEach((card, i) => {
      this.talon[i] = card;
    });
    this.tlen = order.length;
    this.tpos = state.waste.length;
    this.recycles = state.recycles;
    this.drawCount = state.options.drawCount;
    this.maxRecycles = maxRecycles(state.options);
    this.limitedPasses = state.options.maxPasses !== null;
    this.positionMatters = this.drawCount !== 1 || this.limitedPasses;
  }

  // -------------------------------------------------------------------------
  // Hachage
  // -------------------------------------------------------------------------

  private hashInto(out: Int32Array): void {
    let t1 = 0;
    let t2 = 0;
    for (let c = 0; c < COLS; c++) {
      const l = this.len[c] as number;
      const d = this.down[c] as number;
      let a = 0x811c9dc5 ^ (d * 0x9e3779b1);
      let b = 0x1b873593 ^ (d * 0x27d4eb2d) ^ l;
      const base = c * CAP;
      for (let k = 0; k < l; k++) {
        const x = this.tab[base + k] as number;
        a = Math.imul(a ^ x, 0x01000193);
        b = Math.imul(b ^ (x + 101), 0x5bd1e995);
        b ^= b >>> 15;
      }
      t1 = (t1 + fmix(a ^ l)) | 0;
      t2 = (t2 + fmix(b)) | 0;
    }
    const f = this.found;
    const extra =
      ((f[0] as number) |
        ((f[1] as number) << 4) |
        ((f[2] as number) << 8) |
        ((f[3] as number) << 12) |
        (this.positionMatters ? this.tpos << 16 : 0) |
        (this.limitedPasses ? this.recycles << 22 : 0)) >>>
      0;
    out[0] = fmix(t1 ^ Math.imul(extra, 0x9e3779b1));
    out[1] = fmix(t2 + Math.imul(extra ^ 0x5f356495, 0x85ebca6b));
  }

  // -------------------------------------------------------------------------
  // Application / annulation des macro-coups
  // -------------------------------------------------------------------------

  private flipIfNeeded(c: number): number {
    const l = this.len[c] as number;
    if (l > 0 && this.down[c] === l) {
      this.down[c] = l - 1;
      return 1;
    }
    return 0;
  }

  private removeTalon(i: number): number {
    const card = this.talon[i] as number;
    this.talon.copyWithin(i, i + 1, this.tlen);
    this.tlen -= 1;
    return card;
  }

  private insertTalon(i: number, card: number): void {
    this.talon.copyWithin(i + 1, i, this.tlen);
    this.talon[i] = card;
    this.tlen += 1;
  }

  apply(m: number): void {
    let flip = 0;
    this.undoTpos.push(this.tpos);
    this.undoRecycles.push(this.recycles);
    const kind = kindOf(m);
    const src = srcOf(m);
    const dst = dstOf(m);
    switch (kind) {
      case K_TAB_FOUND: {
        const l = (this.len[src] as number) - 1;
        const card = this.tab[src * CAP + l] as number;
        this.len[src] = l;
        this.found[suit(card)] = rank(card);
        this.foundTotal += 1;
        flip = this.flipIfNeeded(src);
        break;
      }
      case K_TAB_TAB: {
        const count = countOf(m);
        const sl = this.len[src] as number;
        const dl = this.len[dst] as number;
        this.tab.copyWithin(dst * CAP + dl, src * CAP + sl - count, src * CAP + sl);
        this.len[src] = sl - count;
        this.len[dst] = dl + count;
        flip = this.flipIfNeeded(src);
        break;
      }
      case K_TALON_FOUND:
      case K_TALON_TAB: {
        const card = this.removeTalon(src);
        if (recycleOf(m)) this.recycles += 1;
        this.tpos = src;
        if (kind === K_TALON_FOUND) {
          this.found[suit(card)] = rank(card);
          this.foundTotal += 1;
        } else {
          const dl = this.len[dst] as number;
          this.tab[dst * CAP + dl] = card;
          this.len[dst] = dl + 1;
        }
        break;
      }
      case K_FOUND_TAB: {
        const card = cardOf(m);
        this.found[src] = rank(card) - 1;
        this.foundTotal -= 1;
        const dl = this.len[dst] as number;
        this.tab[dst * CAP + dl] = card;
        this.len[dst] = dl + 1;
        break;
      }
    }
    this.undoFlip.push(flip);
    this.path.push(m);
  }

  private undoLast(): void {
    const m = this.path.pop() as number;
    const flip = this.undoFlip.pop() as number;
    const prevTpos = this.undoTpos.pop() as number;
    const prevRecycles = this.undoRecycles.pop() as number;
    const kind = kindOf(m);
    const src = srcOf(m);
    const dst = dstOf(m);
    switch (kind) {
      case K_TAB_FOUND: {
        if (flip) this.down[src] = (this.down[src] as number) + 1;
        const card = cardOf(m);
        this.found[suit(card)] = rank(card) - 1;
        this.foundTotal -= 1;
        const l = this.len[src] as number;
        this.tab[src * CAP + l] = card;
        this.len[src] = l + 1;
        break;
      }
      case K_TAB_TAB: {
        if (flip) this.down[src] = (this.down[src] as number) + 1;
        const count = countOf(m);
        const sl = this.len[src] as number;
        const dl = this.len[dst] as number;
        this.tab.copyWithin(src * CAP + sl, dst * CAP + dl - count, dst * CAP + dl);
        this.len[src] = sl + count;
        this.len[dst] = dl - count;
        break;
      }
      case K_TALON_FOUND:
      case K_TALON_TAB: {
        const card = cardOf(m);
        if (kind === K_TALON_FOUND) {
          this.found[suit(card)] = rank(card) - 1;
          this.foundTotal -= 1;
        } else {
          this.len[dst] = (this.len[dst] as number) - 1;
        }
        this.insertTalon(src, card);
        break;
      }
      case K_FOUND_TAB: {
        const card = cardOf(m);
        this.found[src] = rank(card);
        this.foundTotal += 1;
        this.len[dst] = (this.len[dst] as number) - 1;
        break;
      }
    }
    this.tpos = prevTpos;
    this.recycles = prevRecycles;
  }

  reseed(seed: number): void {
    this.rngState = (seed * 0x9e3779b1) | 1;
  }

  undoTo(pathLength: number): void {
    while (this.path.length > pathLength) this.undoLast();
  }

  // -------------------------------------------------------------------------
  // Coups sûrs
  // -------------------------------------------------------------------------

  /**
   * Une carte peut monter sans risque si aucune carte de couleur opposée de
   * rang inférieur ne peut encore avoir besoin d'elle au tableau.
   */
  private isSafe(card: number): boolean {
    const r = rank(card);
    const s = suit(card);
    if (this.found[s] !== r - 1) return false;
    if (r <= 2) return true;
    const f = this.found;
    return (
      (f[s ^ 1] as number) >= r - 1 &&
      (f[s ^ 3] as number) >= r - 1 &&
      (f[s ^ 2] as number) >= r - 2
    );
  }

  autoplay(): void {
    let progress = true;
    while (progress) {
      progress = false;
      for (let c = 0; c < COLS; c++) {
        const l = this.len[c] as number;
        if (l === 0) continue;
        const card = this.tab[c * CAP + l - 1] as number;
        if (this.isSafe(card)) {
          this.apply(encode(K_TAB_FOUND, c, 0, 1, card, 0, 0));
          progress = true;
        }
      }
      if (!this.positionMatters) {
        // Pioche 1 illimitée : toute carte sûre de la pioche peut monter sans rien perdre.
        for (let i = 0; i < this.tlen; i++) {
          const card = this.talon[i] as number;
          if (this.isSafe(card)) {
            this.apply(encode(K_TALON_FOUND, i, 0, 1, card, i < this.tpos - 1 ? 1 : 0, 0));
            progress = true;
            break;
          }
        }
      } else if (this.drawCount === 1 && this.tpos > 0) {
        // Pioche 1 limitée : le sommet de la défausse peut monter sans rien perdre.
        const i = this.tpos - 1;
        const card = this.talon[i] as number;
        if (this.isSafe(card)) {
          this.apply(encode(K_TALON_FOUND, i, 0, 1, card, 0, 0));
          progress = true;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Génération des coups
  // -------------------------------------------------------------------------

  private computeReach(): void {
    this.reachCount = 0;
    this.reachSeen.fill(0);
    const push = (i: number, recycle: number): void => {
      if (i < 0 || i >= this.tlen || this.reachSeen[i]) return;
      this.reachSeen[i] = 1;
      this.reachIdx[this.reachCount] = i;
      this.reachRecycle[this.reachCount] = recycle;
      this.reachCount++;
    };
    const canRecycle = this.recycles < this.maxRecycles;
    if (this.tpos > 0) push(this.tpos - 1, 0);
    if (this.drawCount === 1) {
      for (let i = this.tpos; i < this.tlen; i++) push(i, 0);
      if (canRecycle) for (let i = 0; i < this.tpos - 1; i++) push(i, 1);
    } else {
      let j = this.tpos;
      while (j < this.tlen) {
        j = Math.min(j + this.drawCount, this.tlen);
        push(j - 1, 0);
      }
      if (canRecycle) {
        j = 0;
        while (j < this.tlen) {
          j = Math.min(j + this.drawCount, this.tlen);
          push(j - 1, 1);
        }
      }
    }
  }

  /** Une carte de rang `r` et de parité de couleur `red` est-elle disponible pour être posée ? */
  private hasPlaceableCard(r: number, red: number): boolean {
    for (let k = 0; k < this.reachCount; k++) {
      const card = this.talon[this.reachIdx[k] as number] as number;
      if (rank(card) === r && (card & 1) === red) return true;
    }
    for (let c = 0; c < COLS; c++) {
      const d = this.down[c] as number;
      if (d === 0 || (this.len[c] as number) <= d) continue;
      const base = this.tab[c * CAP + d] as number;
      if (rank(base) === r && (base & 1) === red) return true;
    }
    return false;
  }

  private kingWaiting(): boolean {
    for (let c = 0; c < COLS; c++) {
      const d = this.down[c] as number;
      if (d > 0 && (this.len[c] as number) > d && rank(this.tab[c * CAP + d] as number) === 13) {
        return true;
      }
    }
    for (let k = 0; k < this.reachCount; k++) {
      if (rank(this.talon[this.reachIdx[k] as number] as number) === 13) return true;
    }
    return false;
  }

  private genMoves(start: number): number {
    const buf = this.moveBuf;
    let n = start;
    this.computeReach();

    let firstEmpty = -1;
    for (let c = 0; c < COLS; c++) {
      if (this.len[c] === 0) {
        firstEmpty = c;
        break;
      }
    }

    // 1. Tableau → fondation.
    for (let c = 0; c < COLS; c++) {
      const l = this.len[c] as number;
      if (l === 0) continue;
      const card = this.tab[c * CAP + l - 1] as number;
      if (this.found[suit(card)] === rank(card) - 1) {
        const reveals = l - 1 === this.down[c] && l > 1;
        buf[n++] = encode(
          K_TAB_FOUND,
          c,
          0,
          1,
          card,
          0,
          reveals ? P_TAB_FOUND_REVEAL : P_TAB_FOUND,
        );
      }
    }

    // 2. Pioche → fondation.
    for (let k = 0; k < this.reachCount; k++) {
      const i = this.reachIdx[k] as number;
      const card = this.talon[i] as number;
      if (this.found[suit(card)] === rank(card) - 1) {
        const rec = this.reachRecycle[k] as number;
        buf[n++] = encode(K_TALON_FOUND, i, 0, 1, card, rec, P_TALON_FOUND - rec);
      }
    }

    // 3. Tableau → tableau.
    let kingWaiting = -1;
    for (let c = 0; c < COLS; c++) {
      const l = this.len[c] as number;
      const d = this.down[c] as number;
      if (l === 0) continue;
      const baseCard = this.tab[c * CAP + d] as number;
      const baseRank = rank(baseCard);
      for (let t = 0; t < COLS; t++) {
        if (t === c) continue;
        const tl = this.len[t] as number;
        if (tl === 0) {
          if (t === firstEmpty && baseRank === 13 && d > 0) {
            buf[n++] = encode(K_TAB_TAB, c, t, l - d, baseCard, 0, P_KING_REVEAL + d);
          }
          continue;
        }
        const top = this.tab[t * CAP + tl - 1] as number;
        const need = rank(top) - 1;
        const k = d + (baseRank - need);
        if (need < 1 || k < d || k >= l) continue;
        const card = this.tab[c * CAP + k] as number;
        if (((card ^ top) & 1) === 0) continue;
        const count = l - k;
        if (k === d) {
          if (d > 0) {
            buf[n++] = encode(K_TAB_TAB, c, t, count, card, 0, P_REVEAL + d);
          } else {
            if (kingWaiting < 0) kingWaiting = this.kingWaiting() ? 1 : 0;
            if (kingWaiting === 1)
              buf[n++] = encode(K_TAB_TAB, c, t, count, card, 0, P_EMPTY_FOR_KING);
          }
        } else {
          const exposed = this.tab[c * CAP + k - 1] as number;
          const useful =
            this.found[suit(exposed)] === rank(exposed) - 1 ||
            this.hasPlaceableCard(rank(exposed) - 1, (exposed & 1) ^ 1);
          if (useful) buf[n++] = encode(K_TAB_TAB, c, t, count, card, 0, P_PARTIAL);
        }
      }
    }

    // 4. Pioche → tableau.
    for (let k = 0; k < this.reachCount; k++) {
      const i = this.reachIdx[k] as number;
      const rec = this.reachRecycle[k] as number;
      const card = this.talon[i] as number;
      const r = rank(card);
      if (r === 13) {
        if (firstEmpty >= 0) {
          buf[n++] = encode(K_TALON_TAB, i, firstEmpty, 1, card, rec, P_TALON_KING - rec);
        }
        continue;
      }
      for (let t = 0; t < COLS; t++) {
        const tl = this.len[t] as number;
        if (tl === 0) continue;
        const top = this.tab[t * CAP + tl - 1] as number;
        if (rank(top) === r + 1 && ((top ^ card) & 1) === 1) {
          buf[n++] = encode(K_TALON_TAB, i, t, 1, card, rec, P_TALON_TAB - rec);
        }
      }
    }

    // 5. Fondation → tableau (seulement si la carte descendue peut accueillir quelque chose).
    for (let s = 0; s < 4; s++) {
      const r = this.found[s] as number;
      if (r < 2 || r === 13) continue;
      const card = (r - 1) * 4 + s;
      if (!this.hasPlaceableCard(r - 1, (card & 1) ^ 1)) continue;
      for (let t = 0; t < COLS; t++) {
        const tl = this.len[t] as number;
        if (tl === 0) continue;
        const top = this.tab[t * CAP + tl - 1] as number;
        if (rank(top) === r + 1 && ((top ^ card) & 1) === 1) {
          buf[n++] = encode(K_FOUND_TAB, s, t, 1, card, 0, P_FOUND_TAB);
        }
      }
    }

    if (this.noise > 0) {
      // Perturbation déterministe des priorités (redémarrages).
      for (let i = start; i < n; i++) {
        const m = buf[i] as number;
        let x = this.rngState;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.rngState = x;
        const p = Math.min(255, ((m >>> 23) & 255) + ((x >>> 0) % (this.noise + 1)));
        buf[i] = (m & 0x7fffff) | (p << 23);
      }
    }

    // Tri par priorité décroissante (tri par insertion : listes courtes).
    for (let i = start + 1; i < n; i++) {
      const v = buf[i] as number;
      let j = i - 1;
      while (j >= start && (buf[j] as number) < v) {
        buf[j + 1] = buf[j] as number;
        j--;
      }
      buf[j + 1] = v;
    }
    return n;
  }

  // -------------------------------------------------------------------------
  // Recherche
  // -------------------------------------------------------------------------

  private readonly hashTmp = new Int32Array(2);

  /** Repart de zéro (nouvelle table de transposition) pour un redémarrage. */
  resetSearch(): void {
    this.tt = new HashSet64();
    this.msp = 0;
    this.aborted = false;
  }

  dfs(): boolean {
    if (this.foundTotal === DECK_SIZE) return true;
    this.nodes++;
    if (this.nodes > this.maxNodes || ((this.nodes & 1023) === 0 && this.now() > this.deadline)) {
      this.aborted = true;
      return false;
    }
    this.hashInto(this.hashTmp);
    if (!this.tt.add(this.hashTmp[0] as number, this.hashTmp[1] as number)) return false;

    const start = this.msp;
    const end = this.genMoves(start);
    this.msp = end;
    for (let i = start; i < end; i++) {
      const pathLength = this.path.length;
      this.apply(this.moveBuf[i] as number);
      this.autoplay();
      if (this.dfs()) return true;
      if (this.aborted) return false;
      this.undoTo(pathLength);
    }
    this.msp = start;
    return false;
  }
}

/** Rejoue le chemin de macro-coups en coups atomiques légaux (vérifiés par `rules.ts`). */
function expandPath(root: KlondikeState, path: readonly number[]): KlondikeMove[] {
  const state = cloneState(root);
  const moves: KlondikeMove[] = [];
  const play = (move: KlondikeMove): void => {
    applyMove(state, move);
    moves.push(move);
  };
  for (const m of path) {
    const kind = kindOf(m);
    const card = cardOf(m) as Card;
    switch (kind) {
      case K_TAB_FOUND:
        play(moveOf(tableauId(srcOf(m)), foundationId(foundationFor(state, card))));
        break;
      case K_TAB_TAB:
        play(moveOf(tableauId(srcOf(m)), tableauId(dstOf(m)), countOf(m)));
        break;
      case K_FOUND_TAB:
        play(moveOf(foundationId(foundationOfSuit(state, srcOf(m))), tableauId(dstOf(m))));
        break;
      default: {
        // Pioche : on tire (et retourne la défausse) jusqu'à voir la carte voulue.
        let guard = 0;
        while (topOf(state.waste) !== card) {
          // Garde défensive : l'atteignabilité calculée par le solveur garantit la sortie.
          /* v8 ignore start */
          if (++guard > 200) throw new Error('Solveur : carte de pioche introuvable.');
          /* v8 ignore stop */
          play(state.stock.length > 0 ? DRAW : RECYCLE);
        }
        const to =
          kind === K_TALON_FOUND ? foundationId(foundationFor(state, card)) : tableauId(dstOf(m));
        play(moveOf('waste', to));
      }
    }
  }
  // Garde défensive : un chemin trouvé mène toujours à la victoire.
  /* v8 ignore start */
  if (!isWon(state)) throw new Error('Solveur : la solution reconstruite ne gagne pas.');
  /* v8 ignore stop */
  return moves;
}

export function countPasses(moves: readonly KlondikeMove[]): number {
  return 1 + moves.filter((m) => m.type === 'recycle').length;
}

export function solve(state: KlondikeState, options: SolverOptions = {}): SolveResult {
  const now = options.now ?? (() => Date.now());
  const maxNodes = options.maxNodes ?? 250_000;
  const deadline = options.maxTimeMs === undefined ? Infinity : now() + options.maxTimeMs;
  const schedule = options.restarts ?? DEFAULT_RESTARTS;
  const search = new Search(state, maxNodes, deadline, now);
  search.autoplay();
  const rootPath = search.path.length;

  let budgetUsed = 0;
  for (let attempt = 0; attempt < schedule.length; attempt++) {
    const step = schedule[attempt] as RestartStep;
    const last = attempt === schedule.length - 1;
    const budget = last ? maxNodes - budgetUsed : Math.floor(maxNodes * step.share);
    search.resetSearch();
    search.noise = step.noise;
    search.reseed(attempt + 1);
    search.maxNodes = search.nodes + budget;
    budgetUsed += budget;
    if (search.dfs()) {
      const moves = expandPath(state, search.path);
      return { status: 'solved', moves, nodes: search.nodes, passes: countPasses(moves) };
    }
    search.undoTo(rootPath);
    // Recherche épuisée sans atteindre la limite : inutile de recommencer.
    if (!search.aborted) return { status: 'unsolved', moves: [], nodes: search.nodes, passes: 0 };
    if (now() > deadline) break;
  }
  return { status: 'limit', moves: [], nodes: search.nodes, passes: 0 };
}
