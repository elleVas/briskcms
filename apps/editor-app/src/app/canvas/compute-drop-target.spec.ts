import { describe, expect, it } from 'vitest';
import { computeDropTarget } from './compute-drop-target.js';

const rects = [
  { id: 'a', top: 0, height: 100 },
  { id: 'b', top: 100, height: 100 },
  { id: 'c', top: 200, height: 100 },
];

describe('computeDropTarget', () => {
  it('drops before the first block when the pointer is above its midpoint', () => {
    expect(computeDropTarget(rects, 'c', 10)).toEqual({
      index: 0,
      indicatorTop: 0,
    });
  });

  it('drops between two blocks when the pointer is past the first midpoint but before the second', () => {
    expect(computeDropTarget(rects, 'c', 120)).toEqual({
      index: 1,
      indicatorTop: 100,
    });
  });

  it('drops at the end when the pointer is past the last midpoint', () => {
    expect(computeDropTarget(rects, 'a', 260)).toEqual({
      index: 2,
      indicatorTop: 300,
    });
  });

  it('excludes the dragged block itself from the candidate list and index math', () => {
    // Trascinando "b" oltre il punto medio di "a" (l'unico altro sopra di
    // esso) — l'indice risultante è relativo all'elenco SENZA "b", pronto
    // per moveBlock che lo rimuove prima di reinserirlo.
    expect(computeDropTarget(rects, 'b', 60)).toEqual({
      index: 1,
      indicatorTop: 200,
    });
  });

  it('returns null when the dragged block is the only one present', () => {
    expect(
      computeDropTarget([{ id: 'a', top: 0, height: 100 }], 'a', 50),
    ).toBeNull();
  });

  it('drops exactly at a midpoint by treating it as already past (pointerY > midpoint is strict)', () => {
    // Midpoint di "a" è 50 — esattamente uguale non supera la soglia.
    expect(computeDropTarget(rects, 'c', 50)).toEqual({
      index: 0,
      indicatorTop: 0,
    });
  });
});
