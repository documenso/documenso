import React, { useState } from "react";
import Draggable from "react-draggable";
import Logo from "../logo";
import { IconButton } from "@documenso/ui";
import { XCircleIcon } from "@heroicons/react/20/solid";
const stc = require("string-to-color");

type FieldPropsType = {
  field: {
    color: string;
    type: string;
    position: any;
    positionX: number;
    positionY: number;
    id: string;
    Recipient: { name: ""; email: "" };
  };
  onPositionChanged: any;
  onDelete: any;
  hidden: boolean;
};

export default function EditableField(props: FieldPropsType) {
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
      cancel="strong"
      onMouseDown={(e: any) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        hidden={props.hidden}
        ref={nodeRef}
        className="cursor-move opacity-80 p-2 m-auto w-auto flex-row-reverse text-lg font-bold text-center absolute top-0 left-0 select-none"
        style={{
          background: stc(props.field.Recipient.email),
        }}
      >
        <div className="mb-2 pointer-events-none">
          <Logo className="w-16 mx-auto"></Logo>
        </div>
        <div className="m-auto w-auto flex-row-reverse text-lg font-bold text-center">
          {field.type}
          {field.type === "SIGNATURE" ? (
            <div className="text-xs text-center">
              {`${props.field.Recipient?.name} <${props.field.Recipient?.email}>`}
            </div>
          ) : (
            ""
          )}
        </div>
        <strong>
          <IconButton
            className="absolute top-0 right-0 -m-5"
            color="secondary"
            icon={XCircleIcon}
            onClick={(event: any) => {
              props.onDelete(props.field.id);
            }}
          ></IconButton>
        </strong>
      </div>
    </Draggable>
  );
}
