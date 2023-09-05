'use client';

import React, { useEffect, useState } from 'react';

export type ElementVisibleProps = {
  target: string;
  children: React.ReactNode;
};

export const ElementVisible = ({ target, children }: ElementVisibleProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver((_mutations) => {
      const $el = document.querySelector(target);

      setVisible(!!$el);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [target]);

  useEffect(() => {
    setVisible(!!document.querySelector(target));
  }, [target]);

  if (!visible) {
    return null;
  }

  return <>{children}</>;
};
