'use client';

import React, { useEffect, useState } from 'react';

import Confetti from 'react-confetti';
import { createPortal } from 'react-dom';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { useWindowSize } from '@documenso/lib/client-only/hooks/use-window-size';

export const ConfettiScreen = ({
  numberOfPieces: numberOfPiecesProp = 200,
  ...props
}: React.ComponentPropsWithoutRef<typeof Confetti> & { duration?: number }) => {
  const isMounted = useIsMounted();
  const { width, height } = useWindowSize();

  const [numberOfPieces, setNumberOfPieces] = useState(numberOfPiecesProp);

  useEffect(() => {
    if (!props.duration) {
      return;
    }

    const timer = setTimeout(() => {
      setNumberOfPieces(0);
    }, props.duration);

    return () => clearTimeout(timer);
  }, [props.duration]);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <Confetti
      {...props}
      className="w-full"
      numberOfPieces={numberOfPieces}
      width={width}
      height={height}
    />,
    document.body,
  );
};
