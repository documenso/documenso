import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Fragment, useState } from "react";
import { FieldType } from "@prisma/client";
import { Listbox, RadioGroup, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { classNames } from "@documenso/lib";
import { createOrUpdateField, deleteField } from "@documenso/lib/api";
import { createField } from "@documenso/features/editor";
const stc = require("string-to-color");

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFEditor(props: any) {
  const router = useRouter();
  const [selectedRecipient, setSelectedRecipient]: any = useState(
    props?.document?.Recipient[0]
  );
  const noRecipients = props?.document?.Recipient?.length === 0;
  const [fields, setFields] = useState<any[]>(props.document.Field);
  const fieldTypes = [
    { name: "Signature" },
    { name: "Text" },
    { name: "Date" },
  ];
  const [selectedFieldType, setSelectedFieldType] = useState(
    fieldTypes[0].name
  );

  function onPositionChangedHandler(position: any, id: any) {
    if (!position) return;
    const movedField = fields.find((e) => e.id == id);
    movedField.positionX = position.x.toFixed(0);
    movedField.positionY = position.y.toFixed(0);
    createOrUpdateField(props.document, movedField);

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
      <div>
        <PDFViewer
          readonly={false}
          document={props.document}
          fields={fields}
          onPositionChanged={onPositionChangedHandler}
          onDelete={onDeleteHandler}
          pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
          onMouseUp={(e: any, page: number) => {
            e.preventDefault();
            e.stopPropagation();
            addField(e, page);
          }}
          onMouseDown={(e: any, page: number) => {
            addField(e, page);
          }}
        ></PDFViewer>
        <div
          hidden={noRecipients}
          className="fixed left-0 top-1/3 max-w-xs border border-slate-300 bg-white py-4 pr-5 rounded-md"
        >
          <Listbox value={selectedRecipient} onChange={setSelectedRecipient}>
            {({ open }) => (
              <div className="relative mt-1 mb-2">
                <Listbox.Button className="select-none relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon sm:text-sm">
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
                            active
                              ? "text-white bg-neon-dark"
                              : "text-gray-900",
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
          <hr className="m-3 border-slate-300"></hr>
          <div>
            <RadioGroup
              value={selectedFieldType}
              onChange={setSelectedFieldType}
            >
              <div className="space-y-4">
                {fieldTypes.map((fieldType) => (
                  <RadioGroup.Option
                    onMouseDown={() => {
                      setSelectedFieldType(fieldType.name);
                    }}
                    key={fieldType.name}
                    value={fieldType.name}
                    className={({ checked, active }) =>
                      classNames(
                        checked ? "border-neon border-2" : "border-transparent",
                        "hover:bg-slate-100 select-none relative block cursor-pointer rounded-lg border bg-white px-3 py-2 focus:outline-none sm:flex sm:justify-between"
                      )
                    }
                  >
                    {({ active, checked }) => (
                      <>
                        <span className="flex items-center">
                          <span className="flex flex-col text-sm">
                            <RadioGroup.Label
                              as="span"
                              className="font-medium text-gray-900"
                            >
                              <span
                                className="inline-block h-4 w-4 flex-shrink-0 rounded-full mr-3 align-middle"
                                style={{
                                  background: stc(selectedRecipient?.email),
                                }}
                              />
                              <span className="align-middle">
                                {" "}
                                {fieldType.name}
                              </span>
                            </RadioGroup.Label>
                          </span>
                        </span>
                      </>
                    )}
                  </RadioGroup.Option>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>
    </>
  );

  function addField(
    e: any,
    page: number,
    type: FieldType = FieldType.SIGNATURE
  ) {
    const signatureField = createField(
      e,
      page,
      selectedRecipient,
      FieldType.SIGNATURE
    );

    createOrUpdateField(props?.document, signatureField).then((res) => {
      setFields(fields.concat(res));
    });
  }
}
