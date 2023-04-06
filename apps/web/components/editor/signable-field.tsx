import React, { useState } from "react";
import { classNames } from "@documenso/lib";
import { IconButton } from "@documenso/ui";
import { XCircleIcon } from "@heroicons/react/20/solid";
import Draggable from "react-draggable";

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
        // e.preventDefault();
        e.stopPropagation();
      }}>
      <div
        onClick={(e: any) => {
          if (!field?.signature) props.onClick(props.field);
        }}
        ref={nodeRef}
        className={classNames(
          "absolute top-0 left-0 m-auto h-16 w-48 select-none flex-row-reverse text-center text-lg font-bold opacity-80",
          field.type === "SIGNATURE" ? "cursor-pointer hover:brightness-50" : "cursor-not-allowed"
        )}
        style={{
          background: stc(props.field.Recipient.email),
        }}>
        <div hidden={field?.signature} className="my-4 font-medium">
          {field.type === "SIGNATURE" ? "SIGN HERE" : ""}
          {field.type === "DATE" ? <small>Date (filled on sign)</small> : ""}
        </div>
        <div
          hidden={!field?.signature}
          className="font-qwigley m-auto w-auto flex-row-reverse text-center text-5xl font-medium">
          {field?.signature?.type === "type" ? (
            <div className="my-4">{field?.signature.typedSignature}</div>
          ) : (
            ""
          )}

          {field?.signature?.type === "draw" ? (
            <img className="h-16 w-48" src={field?.signature?.signatureImage} />
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
