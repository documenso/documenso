import React from "react";
import { Transition, Dialog as DialogComponent } from "@headlessui/react";
import { Fragment } from "react";
import { Button } from "@documenso/ui";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { sendSigningRequests } from "@documenso/lib/api";

export function Dialog({ open, setOpen, document, formValues, setLoading }: any) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <DialogComponent as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-full p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogComponent.Panel className="relative px-4 pt-5 pb-4 overflow-hidden text-left transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                    <EnvelopeIcon className="w-6 h-6 text-green-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <DialogComponent.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Ready to send
                    </DialogComponent.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {`"${document.title}" will be sent to ${
                          formValues.filter((s: any) => s.email && s.sendStatus != "SENT").length
                        } recipients.`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:flex-none ">
                  <Button color="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setOpen(false);
                      setLoading(true);
                      sendSigningRequests(document).finally(() => {
                        setLoading(false);
                      });
                    }}
                  >
                    Send
                  </Button>
                </div>
              </DialogComponent.Panel>
            </Transition.Child>
          </div>
        </div>
      </DialogComponent>
    </Transition.Root>
  );
}
