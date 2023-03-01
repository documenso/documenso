import { useEffect, useState } from "react";
import { RadioGroup } from "@headlessui/react";
import { classNames } from "@documenso/lib";
import { FieldType } from "@prisma/client";
const stc = require("string-to-color");

export default function FieldTypeSelector(props: any) {
  const fieldTypes = [
    {
      name: "Signature",
      id: FieldType.SIGNATURE,
    },
    { name: "Date", id: FieldType.DATE },s
  ];

  const [selectedFieldType, setSelectedFieldType] = useState(fieldTypes[0].id);

  useEffect(() => {
    props.onChange(selectedFieldType);
  }, [selectedFieldType]);

  return (
    <RadioGroup
      value={selectedFieldType}
      onChange={(e: any) => {
        setSelectedFieldType(e);
      }}
      onMouseDown={() => {
        props.setAdding(true);
      }}
    >
      <div className="space-y-4">
        {fieldTypes.map((fieldType) => (
          <RadioGroup.Option
            onMouseDown={() => {
              setSelectedFieldType(fieldType.id);
            }}
            key={fieldType.id}
            value={fieldType.id}
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
                          background: stc(props.selectedRecipient?.email),
                        }}
                      />
                      <span className="align-middle">
                        {" "}
                        {
                          fieldTypes.filter((e) => e.id === fieldType.id)[0]
                            .name
                        }
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
  );
}
