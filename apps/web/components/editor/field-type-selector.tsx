import { classNames } from "@documenso/lib";
import { FieldType, Recipient } from "@documenso/prisma/client";
import { RadioGroup } from "@headlessui/react";
import { useState } from "react";
import stc from "string-to-color";

const FIELD_TYPES = [
  {
    name: "Signature",
    id: FieldType.SIGNATURE,
  },
  { name: "Date", id: FieldType.DATE },
];

export interface FieldTypeSelectorProps {
  selectedRecipient: Recipient;
  onChange: (fieldType: FieldType) => void;
}

export default function FieldTypeSelector({
  onChange,
  selectedRecipient,
}: FieldTypeSelectorProps) {
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>(
    FIELD_TYPES[0].id
  );

  const onSelectedFieldTypeChange = (type: FieldType) => {
    setSelectedFieldType(type);
    onChange(type);
  }

  return (
    <RadioGroup
      value={selectedFieldType}
      onChange={(e) => {
        // NOTE: The above handler isn't actually being called
        // instead the onMouseDown handler is capturing the event
        // and calling onSelectedFieldTypeChange directly.
        //
        // We are keeping this though as we may change the
        // implementation to use the onChange handler in the future.
        onSelectedFieldTypeChange(e);
      }}
    >
      <div className="space-y-4">
        {FIELD_TYPES.map((fieldType) => (
          <RadioGroup.Option
            onMouseDown={(e) => {
              // Prevent dragging
              if (e.button === 0) {
                onSelectedFieldTypeChange(fieldType.id);
              };
            }}
            key={fieldType.id}
            value={fieldType.id}
            className={({ checked }) =>
              classNames(
                checked ? "border-neon border-2" : "border-transparent",
                "relative block cursor-pointer select-none rounded-lg border bg-white px-3 py-2 hover:bg-slate-100 focus:outline-none sm:flex sm:justify-between"
              )
            }
          >
            {() => (
              <>
                <span className="flex items-center">
                  <span className="flex flex-col text-sm">
                    <RadioGroup.Label as="span" className="font-medium text-gray-900">
                      <span
                        className="mr-3 inline-block h-4 w-4 flex-shrink-0 rounded-full align-middle"
                        style={{
                          background: stc(selectedRecipient?.email),
                        }}
                      />
                      <span className="align-middle">
                        {
                          FIELD_TYPES.filter((e) => e.id === fieldType.id)[0]
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
