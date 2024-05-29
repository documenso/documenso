declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
  var __prisma_remember: Map<string, any>;
}

export function remember<T>(name: string, getValue: () => T): T {
  const thusly = globalThis;

  if (!thusly.__prisma_remember) {
    thusly.__prisma_remember = new Map();
  }

  if (!thusly.__prisma_remember.has(name)) {
    thusly.__prisma_remember.set(name, getValue());
  }

  return thusly.__prisma_remember.get(name);
}
