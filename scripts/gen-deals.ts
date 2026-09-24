/**
 * Génère la banque de donnes gagnables du Klondike.
 *
 *   npm run gen-deals -- [--mode draw1|draw3|both] [--count 10000] [--limited-count 1000]
 *                        [--workers N] [--nodes 250000]
 *
 * Les graines 1, 2, 3… sont résolues dans l'ordre (en parallèle) ; la banque
 * contient les `count` premières graines résolues. Seule une limite de nœuds est
 * utilisée (jamais de temps) : le résultat est parfaitement reproductible.
 * Chaque solution est rejouée avec les règles avant d'être enregistrée.
 *
 * Quatre banques : pioche 1 et pioche 3, avec passages illimités (option par
 * défaut) puis avec passages limités (LIMITED_PASSES), pour que l'option
 * « passages limités » reste garantie gagnable.
 *
 * Sorties (dans src/core/data/winnable_deals/) :
 * - klondike-drawN[-limited].json : l'index chargé par l'app (graines, difficulté) ;
 * - klondike-drawN[-limited].solutions.txt : une solution encodée par ligne (tests uniquement).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork, type ChildProcess } from 'node:child_process';
import { defaultMaxPasses, isWon, setup, type DrawCount } from '../src/core/games/klondike/rules';
import { solve } from '../src/core/games/klondike/solver';
import { encodeSolution, replaySolution } from '../src/core/games/klondike/solutionCodec';
import { SOLVER } from '../src/config/balance';

interface Task {
  readonly drawCount: DrawCount;
  readonly maxPasses: number | null;
  readonly from: number;
  readonly to: number;
  readonly maxNodes: number;
}

interface DealResult {
  readonly seed: number;
  readonly status: 'solved' | 'unsolved' | 'limit';
  readonly nodes: number;
  readonly code: string;
  /** Déplacements de cartes de la solution (hors taps sur la pioche). */
  readonly moves: number;
  readonly passes: number;
}

const CHUNK = 40;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/core/data/winnable_deals');

function solveRange(task: Task): DealResult[] {
  const out: DealResult[] = [];
  for (let seed = task.from; seed < task.to; seed++) {
    const options = { drawCount: task.drawCount, maxPasses: task.maxPasses };
    const result = solve(setup(seed, options), { maxNodes: task.maxNodes });
    let code = '';
    if (result.status === 'solved') {
      code = encodeSolution(result.moves);
      const check = setup(seed, options);
      replaySolution(check, code);
      if (!isWon(check)) throw new Error(`Graine ${seed} : la solution encodée ne gagne pas.`);
    }
    out.push({
      seed,
      status: result.status,
      nodes: result.nodes,
      code,
      moves: result.moves.filter((m) => m.type === 'move').length,
      passes: result.passes,
    });
  }
  return out;
}

const IS_CHILD = process.argv.includes('--child');
if (IS_CHILD) {
  // Processus de calcul : résout les plages de graines envoyées par le parent.
  process.on('message', (task: Task) => process.send?.(solveRange(task)));
} else {
  void main();
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
}

async function generate(
  drawCount: DrawCount,
  limited: boolean,
  count: number,
  workers: number,
  maxNodes: number,
) {
  const maxPasses = defaultMaxPasses(drawCount, limited);
  const label = `pioche ${drawCount}${limited ? ` (${maxPasses} passage(s))` : ''}`;
  const name = `klondike-draw${drawCount}${limited ? '-limited' : ''}`;
  const started = Date.now();
  const results = new Map<number, DealResult[]>();
  let nextChunk = 0;
  let contiguous = 0; // nombre de blocs consécutifs terminés depuis le début
  let solvedInContiguous = 0;
  // Processus enfants plutôt que threads : le chargeur TypeScript de tsx n'est pas
  // transmis aux worker_threads, alors qu'un enfant lancé avec --import tsx en profite.
  const pool: ChildProcess[] = Array.from({ length: workers }, () =>
    fork(fileURLToPath(import.meta.url), ['--child'], { execArgv: ['--import', 'tsx'] }),
  );

  await new Promise<void>((resolve, reject) => {
    let active = 0;
    const dispatch = (worker: ChildProcess): void => {
      if (solvedInContiguous >= count) {
        if (active === 0) resolve();
        return;
      }
      const chunk = nextChunk++;
      const task: Task = {
        drawCount,
        maxPasses,
        from: 1 + chunk * CHUNK,
        to: 1 + (chunk + 1) * CHUNK,
        maxNodes,
      };
      active++;
      worker.once('message', (message) => {
        const res = message as DealResult[];
        active--;
        results.set(chunk, res);
        while (results.has(contiguous)) {
          solvedInContiguous += (results.get(contiguous) as DealResult[]).filter(
            (r) => r.status === 'solved',
          ).length;
          contiguous++;
        }
        const tested = contiguous * CHUNK;
        process.stdout.write(
          `\r  ${label} : ${solvedInContiguous}/${count} donnes gagnables (${tested} graines testées)   `,
        );
        dispatch(worker);
      });
      worker.send(task);
    };
    for (const w of pool) {
      w.on('error', reject);
      dispatch(w);
    }
  });
  for (const w of pool) w.kill();
  process.stdout.write('\n');

  const all = [...results.keys()]
    .sort((a, b) => a - b)
    .flatMap((k) => results.get(k) as DealResult[]);
  const solved: DealResult[] = [];
  let tested = 0;
  let limit = 0;
  let unsolved = 0;
  for (const r of all) {
    if (solved.length >= count) break;
    tested++;
    if (r.status === 'solved') solved.push(r);
    else if (r.status === 'limit') limit++;
    else unsolved++;
  }

  const index = {
    version: 1,
    variant: 'klondike',
    drawCount,
    maxPasses,
    maxNodes,
    generatedWith: 'npm run gen-deals',
    count: solved.length,
    stats: { tested, solved: solved.length, limit, unsolved },
    seeds: solved.map((r) => r.seed),
    moves: solved.map((r) => r.moves),
    nodes: solved.map((r) => r.nodes),
    passes: solved.map((r) => r.passes),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(index) + '\n');
  writeFileSync(
    join(OUT_DIR, `${name}.solutions.txt`),
    solved.map((r) => `${r.seed} ${r.code}`).join('\n') + '\n',
  );
  const pct = (n: number): string => `${((100 * n) / tested).toFixed(1)} %`;
  console.log(
    `  ${label} : ${tested} graines, ${solved.length} gagnables (${pct(solved.length)}), ` +
      `${limit} à la limite (${pct(limit)}), ${unsolved} épuisées (${pct(unsolved)}) — ` +
      `${((Date.now() - started) / 1000).toFixed(0)} s`,
  );
}

async function main(): Promise<void> {
  const mode = arg('mode', 'both');
  const count = Number(arg('count', '10000'));
  const limitedCount = Number(arg('limited-count', '1000'));
  const workers = Number(arg('workers', String(Math.max(1, availableParallelism()))));
  const maxNodes = Number(arg('nodes', String(SOLVER.bankMaxNodes)));
  console.log(`Génération : ${count} donnes par mode, ${workers} threads, ${maxNodes} nœuds max.`);
  for (const drawCount of [1, 3] as const) {
    if (mode !== 'both' && mode !== `draw${drawCount}`) continue;
    await generate(drawCount, false, count, workers, maxNodes);
    if (limitedCount > 0) await generate(drawCount, true, limitedCount, workers, maxNodes);
  }
}
