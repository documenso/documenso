import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import React, { useState } from "react";
import { Button } from "@documenso/ui";
import short from "short-uuid";
const stc = require("string-to-color");

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFEditor(props: any) {
  const [selectedValue, setSelectedValue] = useState("");
  const [fields, setFields] = useState<any[]>(props.document.Field);
  const router = useRouter();

  function onPositionChangedHandler(position: any, id: any) {
    if (!position) return;
    const newFields = [...fields];
    fields.find((e) => e.id == id).positionX = position.x;
    fields.find((e) => e.id == id).positionY = position.y;

    // no instant redraw neccessary, postion information for saving or later rerender is enough
    // setFields(newFields);
  }

  return (
    <>
      <select
        className="mb-3 inline mt-1 w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        style={{ background: stc(selectedValue) }}
        value={selectedValue}
        onChange={(e) => setSelectedValue(e.target.value)}
      >
        {props?.document?.Recipient?.map((item: any) => (
          <option
            key={item.email + short.generate().toString()}
            style={{
              background: stc(
                item.name ? `${item.name} <${item.email}>` : item.email
              ),
            }}
          >
            {item.name ? `${item.name} <${item.email}>` : item.email}
          </option>
        ))}
      </select>
      <Button
        className="inline ml-1"
        onClick={() => {
          setFields(
            fields.concat({
              id: short.generate().toString(),
              page: 0,
              type: "signature",
              positionX: 0,
              positionY: 0,
              recipient: selectedValue,
            })
          );
        }}
      >
        Add Signature Field
      </Button>
      <Button color="secondary" className="inline ml-1">
        Add Date Field
      </Button>
      <Button color="secondary" className="inline ml-1">
        Add Text Field
      </Button>
      <PDFViewer
        document={props.document}
        fields={fields}
        onPositionChanged={onPositionChangedHandler}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
      />
    </>
  );
}
