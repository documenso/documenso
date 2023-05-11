import React, { useState } from "react";

export function Tooltip(props: any) {
  let timeout: NodeJS.Timeout;
  const [active, setActive] = useState(false);

  const showTip = () => {
    timeout = setTimeout(() => {
      setActive(true);
    }, props.delay || 40);
  };

  const hideTip = () => {
    clearInterval(timeout);
    setActive(false);
  };

  return (
    <div
      className="relative"
      onPointerEnter={showTip}
      onPointerLeave={hideTip}
    >
      {props.children}
      {active && (
        <div className="absolute left-1/4 -translate-x-1/2 bottom-9 transform px-4">
          <span className="text-xs inline-block py-1 px-2 rounded text-neon-800 bg-neon-200">
            {props.label}
          </span>
        </div>
      )}
    </div>
  );
};
