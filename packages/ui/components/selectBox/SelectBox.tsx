import React, { Fragment, useState } from "react";
import { classNames } from "@documenso/lib";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";

export function SelectBox(props: any) {
  return (
    <div className={props.className}>
      <Listbox
        value={props.value}
        onChange={(e) => {
          props.onChange(e);
        }}>
        {({ open }) => (
          <>
            <Listbox.Label className="block text-sm font-medium text-gray-700">
              {props.label}
            </Listbox.Label>
            <div className="relative mt-1">
              <Listbox.Button className="focus:border-neon focus:ring-neon relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-1 sm:text-sm">
                <span className="block truncate">{props?.value?.label}</span>
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
                  {props.options.map((option: any) => (
                    <Listbox.Option
                      key={option.value}
                      className={({ active }) =>
                        classNames(
                          active ? "bg-neon text-white" : "text-gray-900",
                          "relative cursor-default select-none py-2 pl-3 pr-9"
                        )
                      }
                      value={option}>
                      {({ selected, active }) => (
                        <>
                          <span
                            className={classNames(
                              selected ? "font-semibold" : "font-normal",
                              "block truncate"
                            )}>
                            {option.label}
                          </span>

                          {option.value === props.value.value ? (
                            <span
                              className={classNames(
                                active ? "text-white" : "text-neon",
                                "absolute inset-y-0 right-0 flex items-center pr-4"
                              )}>
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
}
