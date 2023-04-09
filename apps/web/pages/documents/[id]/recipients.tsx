import { ReactElement, useRef, useState } from "react";
import Head from "next/head";
import { NEXT_PUBLIC_WEBAPP_URL, classNames } from "@documenso/lib";
import { createOrUpdateRecipient, deleteRecipient, sendSigningRequests } from "@documenso/lib/api";
import { getDocument } from "@documenso/lib/query";
import { getUserFromToken } from "@documenso/lib/server";
import { Breadcrumb, Button, Dialog, IconButton } from "@documenso/ui";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  CheckIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { DocumentStatus, Document as PrismaDocument } from "@prisma/client";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";

export type FormValues = {
  signers: { id: number; email: string; name: string }[];
};

const RecipientsPage: NextPageWithLayout = (props: any) => {
  const title: string = `"` + props?.document?.title + `"` + "Recipients | Documenso";
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
      href: NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id + "/recipients",
    },
  ];

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    defaultValues: { signers: props?.document?.Recipient },
  });
  const {
    register,
    trigger,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({
    keyName: "dieldArrayId",
    name: "signers",
    control,
  });
  const formValues = useWatch({ control, name: "signers" });
  const cancelButtonRef = useRef(null);
  const hasEmailError = (formValue: any): boolean => {
    const index = formValues.findIndex((e) => e.id === formValue.id);
    return !!errors?.signers?.[index]?.email;
  };

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="mt-10 px-6 sm:px-0">
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
              icon={ArrowDownTrayIcon}
              color="secondary"
              className="mr-2"
              href={"/api/documents/" + props.document.id}>
              Download
            </Button>
            {props.document.status !== DocumentStatus.COMPLETED && (
              <>
                <Button
                  icon={PencilSquareIcon}
                  disabled={props.document.status === DocumentStatus.COMPLETED}
                  color={
                    props.document.status === DocumentStatus.COMPLETED ? "primary" : "secondary"
                  }
                  className="mr-2"
                  href={breadcrumbItems[1].href}>
                  Edit Document
                </Button>
                <Button
                  className="min-w-[125px]"
                  color="primary"
                  icon={PaperAirplaneIcon}
                  onClick={() => {
                    setOpen(true);
                  }}
                  disabled={
                    (formValues.length || 0) === 0 ||
                    !formValues.some(
                      (r: any) => r.email && !hasEmailError(r) && r.sendStatus === "NOT_SENT"
                    ) ||
                    loading
                  }>
                  Send
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-md bg-white p-4 shadow sm:p-6">
          <div className="border-b border-gray-200 pb-3 sm:pb-5">
            <h3 className="text-lg font-medium leading-6 text-gray-900 ">Signers</h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              The people who will sign the document.
            </p>
          </div>
          <FormProvider {...form}>
            <form
              onChange={() => {
                trigger();
              }}>
              <ul role="list" className="divide-y divide-gray-200">
                {fields.map((item: any, index: number) => (
                  <li
                    key={index}
                    className="group w-full border-0 px-2 py-3 hover:bg-green-50 sm:py-4">
                    <div id="container" className="block w-full lg:flex lg:justify-between">
                      <div className="block space-y-2 md:flex md:space-x-2 md:space-y-0">
                        <div
                          className={classNames(
                            "focus-within:border-neon focus-within:ring-neon rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:ring-1 md:w-[250px]",
                            item.sendStatus === "SENT" ? "bg-gray-100" : ""
                          )}>
                          <label htmlFor="name" className="block text-xs font-medium text-gray-900">
                            Email
                          </label>
                          <input
                            type="email"
                            {...register(`signers.${index}.email`, {
                              pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            })}
                            defaultValue={item.email}
                            disabled={item.sendStatus === "SENT" || loading}
                            onBlur={() => {
                              if (!errors?.signers?.[index])
                                createOrUpdateRecipient({
                                  ...formValues[index],
                                  documentId: props.document.id,
                                });
                            }}
                            onKeyDown={(event: any) => {
                              if (event.key === "Enter")
                                if (!errors?.signers?.[index])
                                  createOrUpdateRecipient({
                                    ...formValues[index],
                                    documentId: props.document.id,
                                  });
                            }}
                            className="block w-full border-0  bg-inherit p-0 text-gray-900 placeholder-gray-500 outline-none disabled:bg-neutral-100 sm:text-sm"
                            placeholder="john.dorian@loremipsum.com"
                          />
                          {errors?.signers?.[index] ? (
                            <p className="mt-2 text-sm text-red-600" id="email-error">
                              <XMarkIcon className="inline h-5" /> Invalid Email
                            </p>
                          ) : (
                            ""
                          )}
                        </div>
                        <div
                          className={classNames(
                            "focus-within:border-neon focus-within:ring-neon rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:ring-1 md:w-[250px]",
                            item.sendStatus === "SENT" ? "bg-gray-100" : ""
                          )}>
                          <label htmlFor="name" className="block text-xs font-medium text-gray-900">
                            Name (optional)
                          </label>
                          <input
                            type="text"
                            {...register(`signers.${index}.name`)}
                            defaultValue={item.name}
                            disabled={item.sendStatus === "SENT" || loading}
                            onBlur={() => {
                              if (!errors?.signers?.[index])
                                createOrUpdateRecipient({
                                  ...formValues[index],
                                  documentId: props.document.id,
                                });
                            }}
                            onKeyDown={(event: any) => {
                              if (event.key === "Enter" && !errors?.signers?.[index])
                                createOrUpdateRecipient({
                                  ...formValues[index],
                                  documentId: props.document.id,
                                });
                            }}
                            className="block w-full border-0 bg-inherit p-0 text-gray-900 placeholder-gray-500 outline-none disabled:bg-neutral-100 sm:text-sm"
                            placeholder="John Dorian"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 lg:ml-2">
                        <div className="mb-2 mr-2 flex lg:mr-0">
                          <div key={item.id} className="space-x-2">
                            {item.sendStatus === "NOT_SENT" ? (
                              <span
                                id="sent_icon"
                                className="mt-3 inline-block flex-shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                                Not Sent
                              </span>
                            ) : (
                              ""
                            )}
                            {item.sendStatus === "SENT" && item.readStatus !== "OPENED" ? (
                              <span id="sent_icon">
                                <span
                                  id="sent_icon"
                                  className="mt-3 inline-block flex-shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-gray-800 ">
                                  <CheckIcon className="mr-1 inline h-5" /> Sent
                                </span>
                              </span>
                            ) : (
                              ""
                            )}
                            {item.readStatus === "OPENED" && item.signingStatus === "NOT_SIGNED" ? (
                              <span id="read_icon">
                                <span
                                  id="sent_icon"
                                  className="mt-3 inline-block flex-shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                                  <CheckIcon className="-mr-2 inline h-5"></CheckIcon>
                                  <CheckIcon className="mr-1 inline h-5"></CheckIcon>
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
                                  className={`mt-3  inline-block flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium  text-green-800`}>
                                  <CheckBadgeIcon className="mr-1 inline h-5"></CheckBadgeIcon>
                                  Signed
                                </span>
                              </span>
                            ) : (
                              ""
                            )}
                          </div>
                        </div>
                        {props.document.status !== DocumentStatus.COMPLETED && (
                          <div className="mr-1 flex">
                            <IconButton
                              icon={PaperAirplaneIcon}
                              disabled={
                                !item.id ||
                                item.sendStatus !== "SENT" ||
                                item.signingStatus === "SIGNED" ||
                                loading
                              }
                              color="secondary"
                              className="my-auto mr-4 h-9"
                              onClick={() => {
                                if (confirm("Resend this signing request?")) {
                                  setLoading(true);
                                  sendSigningRequests(props.document, [item.id]).finally(() => {
                                    setLoading(false);
                                  });
                                }
                              }}>
                              Resend
                            </IconButton>
                            <IconButton
                              icon={TrashIcon}
                              disabled={!item.id || item.sendStatus === "SENT" || loading}
                              onClick={() => {
                                const removedItem = { ...fields }[index];
                                remove(index);
                                deleteRecipient(item)?.catch((err) => {
                                  append(removedItem);
                                });
                              }}
                              className="group-hover:text-neon-dark group-hover:disabled:text-gray-400"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {props.document.status !== "COMPLETED" && (
                <Button
                  icon={UserPlusIcon}
                  className="mt-3"
                  onClick={() => {
                    createOrUpdateRecipient({
                      id: "",
                      email: "",
                      name: "",
                      documentId: props.document.id,
                    }).then((res) => {
                      append(res);
                    });
                  }}>
                  Add Signer
                </Button>
              )}
            </form>
          </FormProvider>
        </div>
      </div>

      <Dialog
        title="Ready to send"
        document={props.document}
        formValues={formValues}
        open={open}
        setLoading={setLoading}
        setOpen={setOpen}
        icon={<EnvelopeIcon className="h-6 w-6 text-green-600" aria-hidden="true" />}
      />
    </>
  );
};

RecipientsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user)
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  const { id: documentId } = context.query;
  const document: PrismaDocument = await getDocument(+documentId, context.req, context.res);

  return {
    props: {
      document: JSON.parse(JSON.stringify({ ...document, document: "" })),
    },
  };
}

export default RecipientsPage;
