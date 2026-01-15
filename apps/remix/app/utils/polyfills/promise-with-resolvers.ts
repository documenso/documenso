/**
 * Polyfill for Promise.withResolvers (ES2024)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 */

type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

// We're patching here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GlobalPromise = globalThis.Promise as any;

if (typeof GlobalPromise.withResolvers !== 'function') {
  GlobalPromise.withResolvers = function <T>(): PromiseWithResolvers<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };
}

export {};
