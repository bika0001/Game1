import { describe, expect, it } from 'vitest';
import { History } from '../src/core/history';

describe('historique d’annulation', () => {
  it('empile et dépile dans l’ordre', () => {
    const h = new History<number>();
    expect(h.canUndo).toBe(false);
    expect(h.pop()).toBeUndefined();
    expect(h.peek()).toBeUndefined();
    h.push(1);
    h.push(2);
    expect(h.size).toBe(2);
    expect(h.canUndo).toBe(true);
    expect(h.peek()).toBe(2);
    expect(h.pop()).toBe(2);
    expect(h.toArray()).toEqual([1]);
    h.clear();
    expect(h.size).toBe(0);
  });

  it('copie les enregistrements fournis et exportés', () => {
    const source = [1, 2, 3];
    const h = new History(source);
    source.push(4);
    expect(h.size).toBe(3);
    const exported = h.toArray();
    exported.push(9);
    expect(h.size).toBe(3);
  });

  it('n’a pas de limite de taille', () => {
    const h = new History<number>();
    for (let i = 0; i < 100_000; i++) h.push(i);
    expect(h.size).toBe(100_000);
  });
});
