import { ReactElement, useState } from "react";
import Layout from "../components/layout";
import type { NextPageWithLayout } from "./_app";
import Head from "next/head";
import {
  CheckBadgeIcon,
  DocumentPlusIcon,
  EnvelopeIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/router";
import { uploadDocument } from "@documenso/features";
import { DocumentStatus } from "@prisma/client";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { getDocumentsForUserFromToken } from "@documenso/lib/query";
import { Button } from "@documenso/ui";

const DocumentsPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();
  const [documents = [], setDocuments] = useState(props.documents);
  const [loading, setLoading] = useState(false);

  const getDocuments = async () => {
    if (!documents.length) setLoading(true);
    fetch("/api/documents", {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => {
      res.json().then((j) => {
        setDocuments(j);
        setLoading(false);
      });
    });
  };

  function showDocument(documentId: number) {
    router.push("/documents/" + documentId);
  }

  return (
    <>
      <Head>
        <title>Documents | Documenso</title>
      </Head>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center mt-10">
          <div className="sm:flex-auto">
            <header>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
                Documents
              </h1>
            </header>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button
              icon={DocumentPlusIcon}
              onClick={() => {
                document?.getElementById("fileUploadHelper")?.click();
              }}
            >
              Add Document
            </Button>
          </div>
        </div>
        <div className="mt-10 max-w-[1100px]" hidden={!loading}>
          <div className="ph-item">
            <div className="ph-col-12">
              <div className="ph-picture"></div>
              <div className="ph-row">
                <div className="ph-col-6 big"></div>
                <div className="ph-col-4 empty big"></div>
                <div className="ph-col-2 big"></div>
                <div className="ph-col-4"></div>
                <div className="ph-col-8 empty"></div>
                <div className="ph-col-6"></div>
                <div className="ph-col-6 empty"></div>
                <div className="ph-col-12"></div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="mt-8 flex flex-col"
          hidden={!documents.length || loading}
        >
          <div
            className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8"
            hidden={!documents.length || loading}
          >
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Title
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Recipients
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                      >
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {documents.map((document: any) => (
                      <tr
                        key={document.id}
                        className="hover:bg-gray-100 cursor-pointer"
                        onClick={(event) => showDocument(document.id)}
                      >
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.title || "#" + document.id}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.Recipient.map((item: any) => (
                            <div key={item.id}>
                              {item.sendStatus === "SENT" &&
                              item.readStatus !== "OPENED" &&
                              item.signingStatus !== "SIGNED" ? (
                                <span id="sent_icon">
                                  <EnvelopeIcon className="inline h-5 mr-1"></EnvelopeIcon>
                                  {item.email}
                                </span>
                              ) : (
                                ""
                              )}
                              {item.sendStatus === "SENT" &&
                              item.readStatus === "OPENED" ? (
                                <span id="read_icon">
                                  <EyeIcon className="inline h-5 mr-1"></EyeIcon>{" "}
                                  {item.email}
                                </span>
                              ) : (
                                ""
                              )}
                              {item.sendStatus === "SENT" &&
                              item.readStatus === "OPENED" &&
                              item.signingStatus === "SIGNED" ? (
                                <span id="signed_icon">
                                  <CheckBadgeIcon className="inline h-5 mr-1"></CheckBadgeIcon>{" "}
                                  {item.email}
                                </span>
                              ) : (
                                ""
                              )}
                            </div>
                          ))}
                          {document.Recipient.length === 0 ? "-" : null}
                          <ReactTooltip
                            anchorId="sent_icon"
                            place="bottom"
                            content="Document was sent to recipient."
                          />
                          <ReactTooltip
                            anchorId="read_icon"
                            place="bottom"
                            content="Document was opened but not signed yet."
                          />
                          <ReactTooltip
                            anchorId="signed_icon"
                            place="bottom"
                            content="Document was signed by the recipient."
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDocumentStatus(document.status)}
                          <p>
                            <small>
                              {document.signed || 0}/
                              {document.Recipient.length || 0}
                            </small>
                          </p>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link href={"/documents/" + document.id}>
                            <TrashIcon
                              className="flex-shrink-0 -ml-1 mr-3 h-6 w-6 inline text-neon"
                              aria-hidden="true"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (
                                  confirm(
                                    "Are you sure you want to delete this document"
                                  )
                                ) {
                                  fetch(`/api/documents/${document.id}`, {
                                    method: "DELETE",
                                  }).then(() => {
                                    getDocuments();
                                  });
                                }
                              }}
                            />
                            <span className="sr-only">, {document.name}</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="text-center mt-24"
        id="empty"
        hidden={documents.length > 0 || loading}
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>

        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new document.
        </p>
        <div className="mt-6">
          <Button
            icon={PlusIcon}
            onClick={() => {
              document?.getElementById("fileUploadHelper")?.click();
            }}
          >
            Upload Document
          </Button>
          <input
            id="fileUploadHelper"
            type="file"
            onChange={(event: any) => {
              uploadDocument(event);
            }}
            hidden
          />
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      documents: await getDocumentsForUserFromToken(context),
    },
  };
}

function formatDocumentStatus(status: DocumentStatus) {
  switch (status) {
    case DocumentStatus.DRAFT:
      return "Draft";

    case DocumentStatus.PENDING:
      return "Pending";

    case DocumentStatus.COMPLETED:
      return "Completed";
  }
}

DocumentsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsPage;
