import React, { useState } from "react";
import { classNames } from "@documenso/lib";

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
    <div className="relative" onPointerEnter={showTip} onPointerLeave={hideTip}>
      {props.children}
      <div
        className={classNames(
          "absolute left-1/4 -translate-x-1/2 transform px-4 transition-all delay-50 duration-120",
          active && "bottom-9 opacity-100",
          !active && "pointer-events-none bottom-6 opacity-0"
        )}>
        <span className="text-neon-800 bg-neon-200 inline-block rounded py-1 px-2 text-xs">
          {props.label}
        </span>
      </div>
    </div>
  );
};
