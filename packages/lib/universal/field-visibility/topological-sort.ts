export type TopoResult = { kind: 'ok'; order: string[] } | { kind: 'cycle'; path: string[] };

/**
 * Iterative DFS topological sort. Returns `kind: 'cycle'` with the path if the
 * graph is not a DAG. Unknown dependency ids (returned by dependenciesOf but
 * not in ids) are ignored — fail-closed handling happens in the evaluator.
 */
export const topologicalSort = (
  ids: string[],
  dependenciesOf: (id: string) => string[],
): TopoResult => {
  const known = new Set(ids);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  // Each frame tracks the node and an iterator over its known deps so we can
  // resume after pushing a child — avoids re-entering the cycle-detection
  // branch on the same frame after returning from a child.
  const dfs = (start: string): string[] | null => {
    type Frame = { id: string; path: string[]; depsIter: Iterator<string> };

    const makeFrame = (id: string, path: string[]): Frame => {
      const deps = dependenciesOf(id).filter((d) => known.has(d));
      return { id, path, depsIter: deps[Symbol.iterator]() };
    };

    const stack: Frame[] = [makeFrame(start, [start])];
    visiting.add(start);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const next = frame.depsIter.next();

      if (next.done) {
        // All children processed — finalize this node.
        visiting.delete(frame.id);
        visited.add(frame.id);
        order.push(frame.id);
        stack.pop();
        continue;
      }

      const dep = next.value;

      if (visited.has(dep)) continue;

      if (visiting.has(dep)) {
        // Back-edge — found a cycle. Reconstruct the cycle path.
        const path = frame.path;
        const cycleStart = path.indexOf(dep);
        return cycleStart >= 0 ? path.slice(cycleStart).concat(dep) : [dep, dep];
      }

      visiting.add(dep);
      stack.push(makeFrame(dep, frame.path.concat(dep)));
    }

    return null;
  };

  for (const id of ids) {
    if (visited.has(id)) continue;
    const cycle = dfs(id);
    if (cycle) return { kind: 'cycle', path: cycle };
  }

  return { kind: 'ok', order };
};
