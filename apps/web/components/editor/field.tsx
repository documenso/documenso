import { ResizableBox, ResizeCallbackData } from "react-resizable";
import React, { SyntheticEvent, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import Logo from "../logo";
const stc = require("string-to-color");

type FieldPropsType = {
  field: {
    color: string;
    type: string;
    position: any;
    id: string;
    recipient: string;
  };
  onPositionChangedHandler: any;
};

export default function Field(props: FieldPropsType) {
  const [field, setField]: any = useState(props.field);
  const [position, setPosition]: any = useState(
    props.field.position || { x: 0, y: -842 }
  );
  const nodeRef = React.createRef<HTMLDivElement>();
  const onControlledDrag = (e: any, position: any) => {
    const { x, y } = position;
    setPosition({ x, y });
  };

  const onDragStop = (e: any, position: any) => {
    if (!position) return;
    const { x, y } = position;

    props.onPositionChangedHandler({ x, y }, props.field.id);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      position={position}
      onDrag={onControlledDrag}
      onStop={onDragStop}
    >
      <div
        ref={nodeRef}
        style={{ background: stc(props.field.recipient) }}
        className="cursor-move opacity-90 p-2 m-auto w-auto flex-row-reverse text-lg font-bold text-center absolute"
      >
        <div className="m-auto w-auto flex-row-reverse text-lg font-bold text-center">
          {/* todo icons */}
          Signature
          <div className="text-xs text-center">{props.field.recipient}</div>
        </div>
      </div>
    </Draggable>
  );
}
