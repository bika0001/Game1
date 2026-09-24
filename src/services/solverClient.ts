import type { KlondikeMove, KlondikeState } from '../core/games/klondike/rules';
import type { HintSource, SolverRequest, SolverResponse } from '../workers/protocol';
import { handleRequest } from '../workers/solverTasks';

/**
 * Client du Web Worker du solveur. Sans Worker disponible, on se replie sur
 * l'heuristique (rapide) sur le thread principal, jamais sur le solveur complet.
 */
export class SolverClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (response: SolverResponse) => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<SolverResponse>) => {
        const resolve = this.pending.get(event.data.id);
        this.pending.delete(event.data.id);
        resolve?.(event.data);
      };
      this.worker.onerror = () => this.fallBack();
    } catch {
      this.worker = null;
    }
  }

  private fallBack(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [id, resolve] of this.pending) {
      resolve({ id, kind: 'hint', move: null, source: 'none' });
    }
    this.pending.clear();
  }

  private request(request: SolverRequest): Promise<SolverResponse> {
    if (!this.worker) return Promise.resolve(handleRequest(request, false));
    return new Promise((resolve) => {
      this.pending.set(request.id, resolve);
      this.worker?.postMessage(request);
    });
  }

  async hint(state: KlondikeState): Promise<{ move: KlondikeMove | null; source: HintSource }> {
    const response = await this.request({ id: this.nextId++, kind: 'hint', state });
    return response.kind === 'hint' ? response : { move: null, source: 'none' };
  }

  async isBlocked(state: KlondikeState): Promise<boolean> {
    const response = await this.request({ id: this.nextId++, kind: 'blocked', state });
    return response.kind === 'blocked' ? response.blocked : false;
  }
}
