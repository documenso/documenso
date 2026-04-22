import { describe, expect, it } from 'vitest';

import { topologicalSort } from './topological-sort';

type N = { id: string; deps: string[] };

describe('topologicalSort', () => {
  const mk = (nodes: N[]) => ({
    ids: nodes.map((n) => n.id),
    dependenciesOf: (id: string) => nodes.find((n) => n.id === id)?.deps ?? [],
  });

  it('returns input unchanged when no edges exist', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: [] },
      { id: 'b', deps: [] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(new Set(result.order)).toEqual(new Set(['a', 'b']));
  });

  it('sorts dependencies before dependents', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'c', deps: ['b'] },
      { id: 'b', deps: ['a'] },
      { id: 'a', deps: [] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b'));
    expect(result.order.indexOf('b')).toBeLessThan(result.order.indexOf('c'));
  });

  it('does not report a cycle for a diamond (re-convergent DAG)', () => {
    // a -> b, a -> c, b -> d, c -> d  (d is the shared dependency)
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: ['b', 'c'] },
      { id: 'b', deps: ['d'] },
      { id: 'c', deps: ['d'] },
      { id: 'd', deps: [] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.order.indexOf('d')).toBeLessThan(result.order.indexOf('b'));
    expect(result.order.indexOf('d')).toBeLessThan(result.order.indexOf('c'));
  });

  it('detects a direct 2-cycle and returns the path', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: ['b'] },
      { id: 'b', deps: ['a'] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('cycle');
    if (result.kind !== 'cycle') return;
    expect(result.path).toEqual(expect.arrayContaining(['a', 'b']));
    // Closed-walk contract: first node repeats at the end
    expect(result.path[0]).toBe(result.path[result.path.length - 1]);
    expect(result.path.length).toBeGreaterThanOrEqual(3);
  });

  it('detects a 3-cycle', () => {
    const { ids, dependenciesOf } = mk([
      { id: 'a', deps: ['b'] },
      { id: 'b', deps: ['c'] },
      { id: 'c', deps: ['a'] },
    ]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('cycle');
    if (result.kind !== 'cycle') return;
    expect(result.path).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(result.path[0]).toBe(result.path[result.path.length - 1]);
    expect(result.path.length).toBeGreaterThanOrEqual(4);
  });

  it('ignores unknown dependency ids (fail-closed resolution happens elsewhere)', () => {
    const { ids, dependenciesOf } = mk([{ id: 'a', deps: ['missing'] }]);
    const result = topologicalSort(ids, dependenciesOf);
    expect(result.kind).toBe('ok');
  });
});
