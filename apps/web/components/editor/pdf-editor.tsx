import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import React, { useState } from "react";
import { Button } from "@documenso/ui";
import short from "short-uuid";
import toast from "react-hot-toast";
import { FieldType } from "@prisma/client";
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
    const movedField = fields.find((e) => e.id == id);
    movedField.positionX = position.x;
    movedField.positionY = position.y;
    upsertField(props.document, movedField);

    // no instant redraw neccessary, postion information for saving or later rerender is enough
    // setFields(newFields);
  }

  function onDeleteHandler(id: any) {
    const field = fields.find((e) => e.id == id);
    const fieldIndex = fields.map((item) => item.id).indexOf(id);
    console.log(fieldIndex);
    if (fieldIndex > -1) {
      const fieldWithoutRemoved = [...fields];
      const removedField = fieldWithoutRemoved.splice(fieldIndex, 1);
      setFields(fieldWithoutRemoved);
      deleteField(field).catch((err) => {
        setFields(fieldWithoutRemoved.concat(removedField));
      });
    }
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
          const signatureField = {
            id: -1,
            page: 0,
            type: FieldType.SIGNATURE,
            positionX: 0,
            positionY: 0,
            recipient: selectedValue,
          };

          upsertField(props?.document, signatureField).then((res) => {
            setFields(fields.concat(res));
          });
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
        onDelete={onDeleteHandler}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
      />
    </>
  );
}

async function upsertField(document: any, field: any): Promise<any> {
  try {
    const created = await toast.promise(
      fetch("/api/documents/" + document.id + "/fields", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(field),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(res.status.toString());
        }
        return res.json();
      }),
      {
        loading: "Saving...",
        success: "Saved.",
        error: "Could not save :/",
      },
      {
        id: "saving field",
        style: {
          minWidth: "200px",
        },
      }
    );
    return created;
  } catch (error) {}
}

async function deleteField(field: any) {
  if (!field.id) {
    return;
  }

  try {
    const deleted = toast.promise(
      fetch("/api/documents/" + 0 + "/fields/" + field.id, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(field),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(res.status.toString());
        }
        return res;
      }),
      {
        loading: "Deleting...",
        success: "Deleted.",
        error: "Could not delete :/",
      },
      {
        id: "delete",
        style: {
          minWidth: "200px",
        },
      }
    );
    return deleted;
  } catch (error) {}
}
