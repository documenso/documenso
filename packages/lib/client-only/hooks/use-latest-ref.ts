import { useRef } from 'react';

export const useLatestRef = <T>(value: T) => {
  const ref = useRef(value);

  ref.current = value;

  return ref;
};
