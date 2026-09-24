/// <reference lib="webworker" />
import { handleRequest } from './solverTasks';
import type { SolverRequest } from './protocol';

/** Web Worker : le solveur ne tourne jamais sur le thread principal. */
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  self.postMessage(handleRequest(event.data));
};
