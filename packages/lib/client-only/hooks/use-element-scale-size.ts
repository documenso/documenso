import { RefObject, useEffect, useState } from 'react';

/**
 * Given a container and child element, calculate the scaling size to apply to the child.
 */
export function useElementScaleSize(
  container: { width: number; height: number },
  child: RefObject<HTMLElement | null>,
) {
  const [scalingFactor, setScalingFactor] = useState(1);

  useEffect(() => {
    if (!child.current) {
      return;
    }

    setScalingFactor(
      Math.min(
        container.width / child.current.clientWidth,
        container.height / child.current.clientHeight,
        1,
      ),
    );
  }, [
    child,
    child.current?.clientWidth,
    child.current?.clientHeight,
    container.width,
    container.height,
  ]);

  return scalingFactor;
}
