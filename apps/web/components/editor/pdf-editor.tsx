import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import React, { Fragment, useState } from "react";
import { Button } from "@documenso/ui";
import short from "short-uuid";
import toast from "react-hot-toast";
import { FieldType } from "@prisma/client";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { classNames } from "@documenso/lib";
import Draggable from "react-draggable";
const stc = require("string-to-color");

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFEditor(props: any) {
  const [selectedRecipient, setSelectedRecipient]: any = useState(
    props?.document?.Recipient[0]
  );
  const noRecipients = props?.document?.Recipient?.length === 0;
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
      <PDFViewer
        readonly={false}
        document={props.document}
        fields={fields}
        onPositionChanged={onPositionChangedHandler}
        onDelete={onDeleteHandler}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
        onMouseDown={(e: any, page: number) => {
          var rect = e.target.getBoundingClientRect();
          var newFieldX = e.clientX - rect.left; //x position within the element.
          var newFieldY = e.clientY - rect.top; //y position within the element.
          const signatureField = {
            id: -1,
            page: page,
            type: FieldType.SIGNATURE,
            positionX: newFieldX.toFixed(0),
            positionY: newFieldY.toFixed(0),
            Recipient: selectedRecipient,
          };

          upsertField(props?.document, signatureField).then((res) => {
            setFields(fields.concat(res));
          });
        }}
      ></PDFViewer>
      <div hidden={noRecipients} className="fixed left-0 top-1/3 max-w-xs">
        <Listbox value={selectedRecipient} onChange={setSelectedRecipient}>
          {({ open }) => (
            <div className="relative mt-1 mb-2">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon sm:text-sm">
                <span className="flex items-center">
                  <span
                    className="inline-block h-4 w-4 flex-shrink-0 rounded-full"
                    style={{ background: stc(selectedRecipient?.email) }}
                  />
                  <span className="ml-3 block truncate">
                    {`${selectedRecipient?.name} <${selectedRecipient?.email}>`}
                  </span>
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>

              <Transition
                show={open}
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {props?.document?.Recipient?.map((recipient: any) => (
                    <Listbox.Option
                      key={recipient?.id}
                      className={({ active }) =>
                        classNames(
                          active ? "text-white bg-neon-dark" : "text-gray-900",
                          "relative cursor-default select-none py-2 pl-3 pr-9"
                        )
                      }
                      value={recipient}
                    >
                      {({ selected, active }) => (
                        <>
                          <div className="flex items-center">
                            <span
                              className="inline-block h-4 w-4 flex-shrink-0 rounded-full"
                              style={{
                                background: stc(recipient?.email),
                              }}
                            />
                            <span
                              className={classNames(
                                selected ? "font-semibold" : "font-normal",
                                "ml-3 block truncate"
                              )}
                            >
                              {`${selectedRecipient?.name} <${selectedRecipient?.email}>`}
                            </span>
                          </div>

                          {selected ? (
                            <span
                              className={classNames(
                                active ? "text-white" : "text-neon-dark",
                                "absolute inset-y-0 right-0 flex items-center pr-4"
                              )}
                            >
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          )}
        </Listbox>
        <div>
          <Draggable>
            <div
              className="ml-1 cursor-move p-3 border-2 border-slate-200 my-2 rounded-md"
              color="secondary"
            >
              <span
                className="inline-block h-4 w-4 flex-shrink-0 rounded-full mr-3"
                style={{
                  background: stc(selectedRecipient?.email),
                }}
              />
              Add Signature Field
            </div>
          </Draggable>
          <div color="secondary" className="ml-1 ">
            <span
              className="inline-block h-4 w-4 flex-shrink-0 rounded-full mr-3"
              style={{
                background: stc(selectedRecipient?.email),
              }}
            />
            Add Date Field
          </div>
          <div color="secondary" className="ml-1 cursor-move">
            <span
              className="inline-block h-4 w-4 flex-shrink-0 rounded-full mr-3"
              style={{
                background: stc(selectedRecipient?.email),
              }}
            />
            Add Text Field
          </div>
        </div>
      </div>
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
