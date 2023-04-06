import { useEffect, useState } from "react";
import { classNames } from "@documenso/lib";
import { RadioGroup } from "@headlessui/react";
import { FieldType } from "@prisma/client";

const stc = require("string-to-color");

export default function FieldTypeSelector(props: any) {
  const fieldTypes = [
    {
      name: "Signature",
      id: FieldType.SIGNATURE,
    },
    { name: "Date", id: FieldType.DATE },
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
      }}>
      <div className="space-y-4">
        {fieldTypes.map((fieldType) => (
          <RadioGroup.Option
            onMouseDown={(e: any) => {
              if (e.button === 0) setSelectedFieldType(fieldType.id);
            }}
            key={fieldType.id}
            value={fieldType.id}
            className={({ checked, active }) =>
              classNames(
                checked ? "border-neon border-2" : "border-transparent",
                "relative block cursor-pointer select-none rounded-lg border bg-white px-3 py-2 hover:bg-slate-100 focus:outline-none sm:flex sm:justify-between"
              )
            }>
            {({ active, checked }) => (
              <>
                <span className="flex items-center">
                  <span className="flex flex-col text-sm">
                    <RadioGroup.Label as="span" className="font-medium text-gray-900">
                      <span
                        className="mr-3 inline-block h-4 w-4 flex-shrink-0 rounded-full align-middle"
                        style={{
                          background: stc(props.selectedRecipient?.email),
                        }}
                      />
                      <span className="align-middle">
                        {" "}
                        {fieldTypes.filter((e) => e.id === fieldType.id)[0].name}
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
