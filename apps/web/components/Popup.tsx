import React from "react";

type Props = {
  hide: boolean;
};

const Popup = (props: Props) => {
  if (props.hide) {
    return null;
  }
  return (
    <div className="fixed top-0 left-0 z-10 flex h-full w-full items-center  justify-center bg-slate-300 opacity-5">
      <div className="max-w-md bg-slate-300 p-4">x</div>
    </div>
  );
};

export default Popup;
