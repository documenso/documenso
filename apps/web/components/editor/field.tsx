import { ResizableBox, ResizeCallbackData } from "react-resizable";
import React, { SyntheticEvent, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { CircleStackIcon, TrashIcon } from "@heroicons/react/24/solid";
import Logo from "../logo";
import { IconButton } from "@documenso/ui";
import toast from "react-hot-toast";
const stc = require("string-to-color");

type FieldPropsType = {
  field: {
    color: string;
    type: string;
    position: any;
    positionX: number;
    positionY: number;
    id: string;
    recipient: string;
  };
  onPositionChanged: any;
  onDelete: any;
};

export default function Field(props: FieldPropsType) {
  const [field, setField]: any = useState(props.field);
  const [position, setPosition]: any = useState({
    x: props.field.positionX,
    y: props.field.positionY,
  });
  const nodeRef = React.createRef<HTMLDivElement>();
  const onControlledDrag = (e: any, position: any) => {
    const { x, y } = position;
    setPosition({ x, y });
  };

  const onDragStop = (e: any, position: any) => {
    if (!position) return;
    const { x, y } = position;

    props.onPositionChanged({ x, y }, props.field.id);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      position={position}
      onDrag={onControlledDrag}
      onStop={onDragStop}
      defaultPosition={{ x: 0, y: 0 }}
    >
      <div
        ref={nodeRef}
        style={{ background: stc(props.field.recipient) }}
        className="cursor-move opacity-80 p-2 m-auto w-auto flex-row-reverse text-lg font-bold text-center absolute top-0 left-0"
      >
        <div className="m-auto w-auto flex-row-reverse text-lg font-bold text-center">
          <IconButton
            icon={TrashIcon}
            onClick={(event: any) => {
              if (confirm("Delete field?")) {
                props.onDelete(props.field.id);
              }
            }}
          ></IconButton>
          {/* todo icons */}
          {field.type}
          <div className="text-xs text-center">{props.field.recipient}</div>
        </div>
      </div>
    </Draggable>
  );
}
