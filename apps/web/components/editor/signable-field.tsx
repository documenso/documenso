import React, { useState } from "react";
import Draggable from "react-draggable";
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
  onClick: any;
  onDelete: any;
};

export default function SignableField(props: FieldPropsType) {
  const [field, setField]: any = useState(props.field);
  const [position, setPosition]: any = useState({
    x: props.field.positionX,
    y: props.field.positionY,
  });
  const nodeRef = React.createRef<HTMLDivElement>();

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      position={position}
      defaultPosition={{ x: 0, y: 0 }}
      cancel="div"
      onMouseDown={(e: any) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        onClick={() => {
          if (!field?.signature) props.onClick(props.field);
        }}
        ref={nodeRef}
        className="cursor-pointer opacity-80 m-auto w-48 h-16 flex-row-reverse text-lg font-bold text-center absolute top-0 left-0 select-none hover:brightness-50"
        style={{
          background: stc(props.field.Recipient.email),
        }}
      >
        <div hidden={field?.signature} className="font-medium my-4">
          {field.type === "SIGNATURE" ? "SIGN HERE" : ""}
        </div>
        <div
          hidden={!field?.signature}
          className="font-qwigley text-5xl m-auto w-auto flex-row-reverse font-medium text-center"
        >
          {field?.signature?.type === "type" ? (
            <div className="my-4">{field?.signature.typedSignature}</div>
          ) : (
            ""
          )}

          {field?.signature?.type === "draw" ? (
            <img className="w-48 h-16" src={field?.signature?.signatureImage} />
          ) : (
            ""
          )}
          <IconButton
            icon={XCircleIcon}
            color="secondary"
            className="absolute top-0 right-0 -m-5"
            onClick={(event: any) => {
              event.preventDefault();
              event.stopPropagation();
              const newField = { ...field };
              newField.signature = null;
              setField(newField);
              // remove not only signature but whole field if it is a freely places signature
              if (field.type === "FREE_SIGNATURE") props.onDelete(field.id);
            }}
          />
        </div>
      </div>
    </Draggable>
  );
}
