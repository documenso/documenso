import { Dialog, Transition } from "@headlessui/react";

import { classNames, NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";

import toast from "react-hot-toast";
import { Fragment, ReactElement, useRef, useState } from "react";

import { getUserFromToken } from "@documenso/lib/server";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";
import { Breadcrumb, Button, IconButton } from "@documenso/ui";
import { EnvelopeIcon } from "@heroicons/react/24/outline";

export default function ReadyToSend(props: any) {
  const title: string =
    `"` + props?.document?.title + `"` + "Recipients | Documenso";
  const breadcrumbItems = [
    {
      title: "Documents",
      href: "/documents",
    },
    {
      title: props.document.title,
      href: NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id,
    },
    {
      title: "Recipients",
      href:
        NEXT_PUBLIC_WEBAPP_URL +
        "/documents/" +
        props.document.id +
        "/recipients",
    },
  ];

  const [signers, setSigners] = useState(props?.document?.Recipient);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const cancelButtonRef = useRef(null);

  return (
    <Transition.Root show={open} as={Fragment}>
      <ReadyToSend fragment={Fragment} />
      <Dialog
        as="div"
        className="relative z-10"
        initialFocus={cancelButtonRef}
        onClose={setOpen}
      >
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
              <Dialog.Panel className="relative px-4 pt-5 pb-4 overflow-hidden text-left transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                    <EnvelopeIcon
                      className="w-6 h-6 text-green-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Ready to send
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {`"${props.document.title}" will be sent to ${
                          signers.filter((s: any) => s.sendStatus != "SENT")
                            .length
                        } recipients.`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <Button
                    color="secondary"
                    onClick={() => setOpen(false)}
                    ref={cancelButtonRef}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setOpen(false);
                      send(props.document).finally(() => {
                        setLoading(false);
                      });
                    }}
                  >
                    Send
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
