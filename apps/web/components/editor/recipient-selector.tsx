import { Fragment, useEffect, useState } from "react";
import { classNames } from "@documenso/lib";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";

const stc = require("string-to-color");

export default function RecipientSelector(props: any) {
  const [selectedRecipient, setSelectedRecipient]: any = useState(props?.recipients[0]);

  useEffect(() => {
    props.onChange(selectedRecipient);
  }, [selectedRecipient]);

  return (
    <Listbox
      value={selectedRecipient}
      onChange={(e: any) => {
        setSelectedRecipient(e);
      }}>
      {({ open }) => (
        <div className="relative mt-1 mb-2">
          <Listbox.Button className="focus:border-neon focus:ring-neon relative w-full cursor-default select-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-1 sm:text-sm">
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
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {props?.recipients.map((recipient: any) => (
                <Listbox.Option
                  key={recipient?.id}
                  disabled={!recipient?.email}
                  className={({ active }) =>
                    classNames(
                      active ? "bg-neon-dark text-white" : "text-gray-900",
                      "relative cursor-default select-none py-2 pl-3 pr-9 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                    )
                  }
                  value={recipient}>
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
                          )}>
                          {`${recipient?.name} <${recipient?.email || 'unknown'}>`}
                        </span>
                      </div>

                      {selected ? (
                        <span
                          className={classNames(
                            active ? "text-white" : "text-neon-dark",
                            "absolute inset-y-0 right-0 flex items-center pr-4"
                          )}>
                          <CheckIcon className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
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
  );
}
