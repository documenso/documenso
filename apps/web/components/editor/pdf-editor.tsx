import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { createField } from "@documenso/features/editor";
import { createOrUpdateField, deleteField } from "@documenso/lib/api";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import FieldTypeSelector from "./field-type-selector";
import RecipientSelector from "./recipient-selector";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

const stc = require("string-to-color");

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFEditor(props: any) {
  const router = useRouter();
  const [fields, setFields] = useState<any[]>(props.document.Field);
  const [selectedRecipient, setSelectedRecipient]: any = useState();
  const [selectedFieldType, setSelectedFieldType] = useState();
  const noRecipients =
    props?.document.Recipient.length === 0 || props?.document.Recipient.every((e: any) => !e.email);

  function onPositionChangedHandler(position: any, id: any) {
    if (!position) return;
    const movedField = fields.find((e) => e.id == id);
    movedField.positionX = position.x.toFixed(0);
    movedField.positionY = position.y.toFixed(0);
    createOrUpdateField(props.document, movedField);

    // no instant redraw neccessary, position information for saving or later rerender is enough
    // setFields(newFields);
  }

  function onDeleteHandler(id: any) {
    const field = fields.find((e) => e.id == id);
    const fieldIndex = fields.map((item) => item.id).indexOf(id);
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
      <div>
        <div hidden={!noRecipients} className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-yellow-700">
                This document does not have any recipients. Add recipients to create fields.
              </p>
              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                <Link
                  href={NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id + "/recipients"}
                  className="whitespace-nowrap font-medium text-yellow-700 hover:text-yellow-600">
                  Add Recipients
                  <span aria-hidden="true"> &rarr;</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
        <PDFViewer
          style={{
            cursor: !noRecipients
              ? `url("https://place-hold.it/110x64/37f095/FFFFFF&text=${selectedFieldType}") 55 32, auto`
              : "",
          }}
          readonly={false}
          document={props.document}
          fields={fields}
          onPositionChanged={onPositionChangedHandler}
          onDelete={onDeleteHandler}
          pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
          onMouseUp={(e: any, page: number) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e: any, page: number) => {
            if (e.button === 0) addField(e, page);
          }}></PDFViewer>
        <div
          hidden={noRecipients}
          className="fixed left-0 top-1/3 max-w-xs rounded-md border border-slate-300 bg-white py-4 pr-5">
          <RecipientSelector
            recipients={props?.document?.Recipient}
            onChange={setSelectedRecipient}
          />
          <hr className="m-3 border-slate-300"></hr>
          <FieldTypeSelector
            selectedRecipient={selectedRecipient}
            onChange={setSelectedFieldType}
          />
        </div>
      </div>
    </>
  );

  function addField(e: any, page: number) {
    if (!selectedRecipient) return;
    if (!selectedFieldType) return;
    if (noRecipients) return;

    const signatureField = createField(e, page, selectedRecipient, selectedFieldType);

    createOrUpdateField(props?.document, signatureField).then((res) => {
      setFields((prevState) => [...prevState, res]);
    });
  }
}
