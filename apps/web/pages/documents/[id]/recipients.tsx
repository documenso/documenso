import Head from "next/head";
import { Fragment, ReactElement, useRef, useState } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import { classNames, NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  CheckIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { getUserFromToken } from "@documenso/lib/server";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";
import { Breadcrumb, Button, IconButton } from "@documenso/ui";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";

const RecipientsPage: NextPageWithLayout = (props: any) => {
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
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="mt-10">
        <div>
          <Breadcrumb document={props.document} items={breadcrumbItems} />
        </div>
        <div className="mt-2 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {props.document.title}
            </h2>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
            <Button
              icon={PencilSquareIcon}
              color="secondary"
              className="mr-2"
              href={breadcrumbItems[1].href}
            >
              Edit Document
            </Button>
            <Button
              icon={ArrowDownTrayIcon}
              color="secondary"
              className="mr-2"
              href={"/api/documents/" + props.document.id}
            >
              Download
            </Button>
            <Button
              className="min-w-[125px]"
              color="primary"
              icon={PaperAirplaneIcon}
              onClick={() => {
                setLoading(true);
                setOpen(true);
              }}
              disabled={
                (signers.length || 0) === 0 ||
                !signers.some((r: any) => r.sendStatus === "NOT_SENT") ||
                loading
              }
            >
              Send
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md bg-white shadow mt-10 p-6">
          <div className="border-b border-gray-200 pb-5">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Signers
            </h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              The people who will sign the document.
            </p>
          </div>
          <ul role="list" className="divide-y divide-gray-200">
            {signers.map((item: any, index: number) => (
              <li
                key={index}
                className="px-0 py-4 w-full hover:bg-green-50 border-0 group"
              >
                <div id="container" className="flex w-full">
                  <div
                    className={classNames(
                      "ml-3 w-[250px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-neon focus-within:ring-1 focus-within:ring-neon",
                      item.sendStatus === "SENT" ? "bg-gray-100" : ""
                    )}
                  >
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-gray-900"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={item.email}
                      disabled={item.sendStatus === "SENT" || loading}
                      onChange={(e) => {
                        const updatedSigners = [...signers];
                        updatedSigners[index].email = e.target.value;
                        setSigners(updatedSigners);
                      }}
                      onBlur={() => {
                        item.documentId = props.document.id;
                        upsertRecipient(item);
                      }}
                      onKeyDown={(event: any) => {
                        if (event.key === "Enter") upsertRecipient(item);
                      }}
                      className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 sm:text-sm outline-none bg-inherit"
                      placeholder="john.dorian@loremipsum.com"
                    />
                  </div>
                  <div
                    className={classNames(
                      "ml-3 w-[250px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-neon focus-within:ring-1 focus-within:ring-neon",
                      item.sendStatus === "SENT" ? "bg-gray-100" : ""
                    )}
                  >
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-gray-900"
                    >
                      Name (optional)
                    </label>
                    <input
                      type="email"
                      name="name"
                      value={item.name}
                      disabled={item.sendStatus === "SENT" || loading}
                      onChange={(e) => {
                        const updatedSigners = [...signers];
                        updatedSigners[index].name = e.target.value;
                        setSigners(updatedSigners);
                      }}
                      onBlur={() => {
                        item.documentId = props.document.id;
                        upsertRecipient(item);
                      }}
                      onKeyDown={(event: any) => {
                        if (event.key === "Enter") upsertRecipient(item);
                      }}
                      className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 sm:text-sm outline-none bg-inherit"
                      placeholder="John Dorian"
                    />
                  </div>
                  <div className="ml-auto flex">
                    <div key={item.id}>
                      {item.sendStatus === "NOT_SENT" ? (
                        <span
                          id="sent_icon"
                          className="inline-block flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800"
                        >
                          Not Sent
                        </span>
                      ) : (
                        ""
                      )}
                      {item.sendStatus === "SENT" &&
                      item.readStatus !== "OPENED" ? (
                        <span id="sent_icon">
                          <span
                            id="sent_icon"
                            className="inline-block flex-shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-gray-800"
                          >
                            <CheckIcon className="inline h-5 mr-1"></CheckIcon>{" "}
                            Sent
                          </span>
                        </span>
                      ) : (
                        ""
                      )}
                      {item.readStatus === "OPENED" &&
                      item.signingStatus === "NOT_SIGNED" ? (
                        <span id="read_icon">
                          <span
                            id="sent_icon"
                            className="inline-block flex-shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-gray-800"
                          >
                            <CheckIcon className="inline h-5 -mr-2"></CheckIcon>
                            <CheckIcon className="inline h-5 mr-1"></CheckIcon>
                            Seen
                          </span>
                        </span>
                      ) : (
                        ""
                      )}
                      {item.signingStatus === "SIGNED" ? (
                        <span id="signed_icon">
                          <span
                            id="sent_icon"
                            className="inline-block flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          >
                            <CheckBadgeIcon className="inline h-5 mr-1"></CheckBadgeIcon>
                            Signed
                          </span>
                        </span>
                      ) : (
                        ""
                      )}
                    </div>
                  </div>
                  <div className="ml-auto flex mr-1">
                    <IconButton
                      icon={PaperAirplaneIcon}
                      disabled={
                        !item.id ||
                        item.sendStatus !== "SENT" ||
                        item.signingStatus === "SIGNED" ||
                        loading
                      }
                      color="secondary"
                      className="mr-4 h-9 my-auto"
                      onClick={() => {
                        if (confirm("Resend this signing request?")) {
                          setLoading(true);
                          send(props.document, [item.id]).finally(() => {
                            setLoading(false);
                          });
                        }
                      }}
                    >
                      Resend
                    </IconButton>
                    <IconButton
                      icon={TrashIcon}
                      disabled={
                        !item.id || item.sendStatus === "SENT" || loading
                      }
                      onClick={() => {
                        const signersWithoutIndex = [...signers];
                        const removedItem = signersWithoutIndex.splice(
                          index,
                          1
                        );
                        setSigners(signersWithoutIndex);
                        deleteRecipient(item).catch((err) => {
                          setSigners(signersWithoutIndex.concat(removedItem));
                        });
                      }}
                      className="group-hover:text-neon-dark group-hover:disabled:text-gray-400"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Button
            icon={UserPlusIcon}
            className="mt-3"
            onClick={() => {
              upsertRecipient({
                id: "",
                email: "",
                name: "",
                documentId: props.document.id,
              }).then((res) => {
                setSigners(signers.concat(res));
              });
            }}
          >
            Add Signer
          </Button>
        </div>
      </div>
      <Transition.Root show={open} as={Fragment}>
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
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <EnvelopeIcon
                        className="h-6 w-6 text-green-600"
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
    </>
  );
};

// todo encapsulate
async function deleteRecipient(recipient: any) {
  if (!recipient.id) {
    return;
  }

  return toast.promise(
    fetch(
      "/api/documents/" + recipient.documentId + "/recipients/" + recipient.id,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recipient),
      }
    ),
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
}

// todo encapsulate
async function upsertRecipient(recipient: any): Promise<any> {
  try {
    const created = await toast.promise(
      fetch("/api/documents/" + recipient.documentId + "/recipients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recipient),
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
        id: "saving",
        style: {
          minWidth: "200px",
        },
      }
    );
    return created;
  } catch (error) {}
}

RecipientsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  const { id: documentId } = context.query;
  const document: PrismaDocument = await getDocument(
    +documentId,
    context.req,
    context.res
  );

  return {
    props: {
      document: JSON.parse(JSON.stringify({ ...document, document: "" })),
    },
  };
}

// todo encapsulate
async function send(document: any, resendTo: number[] = []) {
  if (!document || !document.id) return;
  try {
    const sent = await toast.promise(
      fetch(`/api/documents/${document.id}/send`, {
        body: JSON.stringify({ resendTo: resendTo }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
        .then((res: any) => {
          if (!res.ok) {
            throw new Error(res.status.toString());
          }
        })
        .finally(() => {
          location.reload();
        }),
      {
        loading: "Sending...",
        success: `Sent!`,
        error: "Could not send :/",
      }
    );
  } catch (err) {
    console.log(err);
  }
}

export default RecipientsPage;
