import {
  applyMove,
  column,
  foundationFor,
  foundationId,
  tableauAccepts,
  tableauId,
  topOf,
  DRAW,
  RECYCLE,
  FOUNDATION_COUNT,
  TABLEAU_COUNT,
  type KlondikeMove,
  type KlondikePileId,
  type KlondikeState,
} from './rules';

/**
 * Encodage compact d'une solution pour la banque de donnes.
 *
 * - « S » : taper la pioche (tirer, ou retourner la défausse si la pioche est vide) ;
 *   « * » suivi d'un chiffre en base 36 (2…35) : autant de taps consécutifs.
 * - Sinon deux caractères, source puis destination :
 *   - source : « W » défausse, « 0 »…« 6 » colonne, « a »…« d » fondation ;
 *   - destination : « F » (la fondation qui accepte la carte), « 0 »…« 6 » colonne.
 *
 * Le nombre de cartes d'un déplacement entre colonnes est implicite : une seule
 * carte de la séquence visible peut aller sur une destination donnée.
 */

const FOUNDATION_LETTERS = 'abcd';

function encodeSource(from: KlondikePileId): string {
  if (from === 'waste') return 'W';
  if (from.startsWith('t')) return from.slice(1);
  return FOUNDATION_LETTERS[Number(from.slice(1))] as string;
}

const MAX_RUN = 35;

function encodeTaps(count: number): string {
  let out = '';
  let left = count;
  while (left > 0) {
    const run = Math.min(left, MAX_RUN);
    out += run === 1 ? 'S' : `*${run.toString(36)}`;
    left -= run;
  }
  return out;
}

export function encodeSolution(moves: readonly KlondikeMove[]): string {
  let out = '';
  let taps = 0;
  for (const move of moves) {
    if (move.type !== 'move') {
      taps++;
      continue;
    }
    out += encodeTaps(taps);
    taps = 0;
    out += encodeSource(move.from);
    out += move.to.startsWith('f') ? 'F' : move.to.slice(1);
  }
  return out + encodeTaps(taps);
}

function parseSource(ch: string): KlondikePileId | null {
  if (ch === 'W') return 'waste';
  const col = ch.charCodeAt(0) - 48;
  if (col >= 0 && col < TABLEAU_COUNT) return tableauId(col);
  const f = FOUNDATION_LETTERS.indexOf(ch);
  if (f >= 0 && f < FOUNDATION_COUNT) return foundationId(f);
  return null;
}

/** Nombre de cartes à déplacer de `from` vers la colonne `to` (0 si impossible). */
function impliedCount(state: KlondikeState, from: number, to: number): number {
  const src = column(state, from);
  const dst = column(state, to);
  for (let k = src.faceDown; k < src.cards.length; k++) {
    if (tableauAccepts(dst, src.cards[k] as number)) return src.cards.length - k;
  }
  return 0;
}

/**
 * Rejoue une solution encodée sur `state` (muté) et renvoie les coups joués.
 * Lève une erreur si le code est malformé ou contient un coup illégal.
 */
export function replaySolution(state: KlondikeState, code: string): KlondikeMove[] {
  const moves: KlondikeMove[] = [];
  const play = (move: KlondikeMove): void => {
    applyMove(state, move);
    moves.push(move);
  };
  let i = 0;
  while (i < code.length) {
    const ch = code[i++] as string;
    if (ch === 'S' || ch === '*') {
      const taps = ch === 'S' ? 1 : parseInt(code[i++] ?? '', 36);
      if (!(taps >= 1)) throw new Error(`Solution malformée à la position ${i}.`);
      for (let t = 0; t < taps; t++) play(state.stock.length > 0 ? DRAW : RECYCLE);
      continue;
    }
    const from = parseSource(ch);
    const dest = code[i++];
    if (!from || dest === undefined) throw new Error(`Solution malformée à la position ${i}.`);
    if (dest === 'F') {
      const cards =
        from === 'waste'
          ? state.waste
          : from.startsWith('t')
            ? column(state, Number(from.slice(1))).cards
            : [];
      const card = topOf(cards);
      const target = card === undefined ? -1 : foundationFor(state, card);
      if (target < 0) throw new Error(`Montée en fondation impossible à la position ${i}.`);
      play({ type: 'move', from, to: foundationId(target), count: 1 });
      continue;
    }
    const to = dest.charCodeAt(0) - 48;
    if (to < 0 || to >= TABLEAU_COUNT) throw new Error(`Destination inconnue à la position ${i}.`);
    const count = from.startsWith('t') ? impliedCount(state, Number(from.slice(1)), to) : 1;
    play({ type: 'move', from, to: tableauId(to), count: Math.max(1, count) });
  }
  return moves;
}
