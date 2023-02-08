import { ResizableBox, ResizeCallbackData } from "react-resizable";
import React, { SyntheticEvent, useState } from "react";
import Draggable from "react-draggable";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import Logo from "../logo";

type FieldPropsType = {
  color: string;
  type: string;
};

export default function Field(props: FieldPropsType) {
  return (
    <Draggable bounds="parent" defaultPosition={{ x: 0, y: -595 }}>
      <ResizableBox
        width={150}
        height={75}
        minConstraints={[170, 75]}
        maxConstraints={[260, 125]}
        className="bg-neon opacity-90 w-auto h-auto flex align-middle"
        lockAspectRatio={true}
        onResizeStart={(e: SyntheticEvent, data: ResizeCallbackData) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="m-auto w-auto flex-row-reverse text-lg font-bold text-center">
          {/* todo icons */}
          Signature
          <div className="text-xs text-center">
            Timur Ercan <br></br>
            {"<timur.ercan31@gmail.com>"}
          </div>
        </div>
      </ResizableBox>
    </Draggable>
  );
}
