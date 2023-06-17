import React, { useMemo } from "react";
import { Fragment } from "react";
import { sendSigningRequests } from "@documenso/lib/api";
import { truncate } from "@documenso/lib/helpers";
import { Button } from "@documenso/ui";
import { Dialog as DialogComponent, Transition } from "@headlessui/react";
import { Document as PrismaDocument } from "@prisma/client";

type FormValue = {
  id: number;
  email: string;
  name: string;
};

type DialogProps = {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  document: PrismaDocument;
  formValues: FormValue[];
  setLoading: (loading: boolean) => void;
  icon: React.ReactNode;
  truncateTitle?: boolean;
};

export function Dialog({
  title,
  open,
  setOpen,
  document,
  formValues,
  setLoading,
  icon,
  truncateTitle = true,
}: DialogProps) {
  const unsentEmailsLength = formValues.filter(
    (s: any) => s.email && s.sendStatus != "SENT"
  ).length;

  const documentTitle = truncateTitle ? truncate(document.title) : document.title;

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
          leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <DialogComponent.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    {icon}
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <DialogComponent.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900">
                      {title}
                    </DialogComponent.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {`"${documentTitle}" will be sent to ${unsentEmailsLength} recipients.`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-3 sm:mt-6 sm:grid sm:flex-none sm:grid-flow-row-dense sm:grid-cols-2 ">
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
                    }}>
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
