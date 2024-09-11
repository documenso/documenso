import { useCallback, useRef, useState } from 'react';

type ThrottleOptions = {
  leading?: boolean;
  trailing?: boolean;
};

export function useThrottleFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms = 500,
  options: ThrottleOptions = {},
): [(...args: Parameters<T>) => void, boolean, () => void] {
  const [isThrottling, setIsThrottling] = useState(false);
  const $isThrottling = useRef(false);

  const $timeout = useRef<NodeJS.Timeout | null>(null);
  const $lastArgs = useRef<Parameters<T> | null>(null);

  const { leading = true, trailing = true } = options;

  const $setIsThrottling = useCallback((value: boolean) => {
    $isThrottling.current = value;
    setIsThrottling(value);
  }, []);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      if (!$isThrottling.current) {
        $setIsThrottling(true);
        if (leading) {
          fn(...args);
        } else {
          $lastArgs.current = args;
        }

        $timeout.current = setTimeout(() => {
          if (trailing && $lastArgs.current) {
            fn(...$lastArgs.current);
            $lastArgs.current = null;
          }
          $setIsThrottling(false);
        }, ms);
      } else {
        $lastArgs.current = args;
      }
    },
    [fn, ms, leading, trailing, $setIsThrottling],
  );

  const cancel = useCallback(() => {
    if ($timeout.current) {
      clearTimeout($timeout.current);
      $timeout.current = null;
      $setIsThrottling(false);
      $lastArgs.current = null;
    }
  }, [$setIsThrottling]);

  return [throttledFn, isThrottling, cancel];
}
