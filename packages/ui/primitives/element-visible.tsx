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

      // Wait a fraction of a second to allow the scrollbar to load if it exists.
      // If we don't wait, then the elements on the first page will be
      // shifted across.
      setTimeout(() => {
        setVisible(!!$el);
      }, 100);
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
