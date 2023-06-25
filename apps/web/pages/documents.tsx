import { ReactElement, useEffect, useState } from "react";
import { NextPageContext } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { uploadDocument } from "@documenso/features";
import { deleteDocument, getDocuments } from "@documenso/lib/api";
import { useSubscription } from "@documenso/lib/stripe";
import { Button, IconButton, SelectBox } from "@documenso/ui";
import Layout from "../components/layout";
import type { NextPageWithLayout } from "./_app";
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  CheckIcon,
  DocumentPlusIcon,
  EnvelopeIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { DocumentStatus } from "@prisma/client";
import { Tooltip as ReactTooltip } from "react-tooltip";

const DocumentsPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();
  const { hasSubscription } = useSubscription();
  const [documents, setDocuments]: any[] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);

  const [loading, setLoading] = useState(true);

  type statusFilterType = {
    label: string;
    value: DocumentStatus | "ALL";
  };

  const statusFilters: statusFilterType[] = [
    { label: "All", value: "ALL" },
    { label: "Draft", value: "DRAFT" },
    { label: "Waiting for others", value: "PENDING" },
    { label: "Completed", value: "COMPLETED" },
  ];
  const createdFilter = [
    { label: "All Time", value: -1 },
    { label: "Last 24 hours", value: 1 },
    { label: "Last 7 days", value: 7 },
    { label: "Last 30 days", value: 30 },
    { label: "Last 3 months", value: 90 },
    { label: "Last 12 months", value: 366 },
  ];

  const [selectedStatusFilter, setSelectedStatusFilter] = useState(statusFilters[0]);
  const [selectedCreatedFilter, setSelectedCreatedFilter] = useState(createdFilter[0]);

  const loadDocuments = async () => {
    if (!documents.length) setLoading(true);
    getDocuments().then((res: any) => {
      res.json().then((j: any) => {
        setDocuments(j);
        setLoading(false);
      });
    });
  };

  useEffect(() => {
    loadDocuments().finally(() => {
      setSelectedStatusFilter(
        statusFilters.filter((status) => status.value === props.filter.toUpperCase())[0]
      );
    });
  }, []);

  useEffect(() => {
    setFilteredDocuments(filterDocumentes(documents));
  }, [documents, selectedStatusFilter, selectedCreatedFilter]);

  function showDocument(documentId: number) {
    router.push(`/documents/${documentId}/recipients`);
  }

  function filterDocumentes(documents: []): any {
    let filteredDocuments = documents.filter(
      (d: any) => d.status === selectedStatusFilter.value || selectedStatusFilter.value === "ALL"
    );

    filteredDocuments = filteredDocuments.filter((document: any) =>
      wasXDaysAgoOrLess(new Date(document.created), selectedCreatedFilter.value)
    );

    return filteredDocuments;
  }

  function handleStatusFilterChange(status: statusFilterType) {
    router.replace(
      {
        pathname: router.pathname,
        query: { filter: status.value },
      },
      undefined,
      {
        shallow: true, // Perform a shallow update, without reloading the page
      }
    );
    setSelectedStatusFilter(status);
  }

  function wasXDaysAgoOrLess(documentDate: Date, lastXDays: number): boolean {
    if (lastXDays < 0) return true;

    const millisecondsInDay = 24 * 60 * 60 * 1000; // Number of milliseconds in a day
    const today: Date = new Date(); // Today's date

    // Calculate the difference between the two dates in days
    const diffInDays = Math.floor((today.getTime() - documentDate.getTime()) / millisecondsInDay);

    console.log(diffInDays);

    // Check if the difference is letss or equal to lastXDays
    return diffInDays <= lastXDays;
  }

  return (
    <>
      <Head>
        <title>Documents | Documenso</title>
      </Head>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mt-10 sm:flex sm:items-center">
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
              disabled={!hasSubscription}
              onClick={() => {
                document?.getElementById("fileUploadHelper")?.click();
              }}>
              Add Document
            </Button>
          </div>
        </div>
        <div className="mt-3 mb-12 flex flex-wrap items-center justify-start gap-x-4 md:justify-end gap-y-4">
          <SelectBox
            className="block flex-1 md:flex-none md:w-1/4"
            label="Status"
            options={statusFilters}
            value={selectedStatusFilter}
            onChange={handleStatusFilterChange}
          />
          <SelectBox
            className="block flex-1 md:flex-none md:w-1/4"
            label="Created"
            options={createdFilter}
            value={selectedCreatedFilter}
            onChange={setSelectedCreatedFilter}
          />
          <div className="block w-fit pt-5">
            {filteredDocuments.length != 1 ? filteredDocuments.length + " Documents" : "1 Document"}
          </div>
        </div>
        <div className="mt-8 max-w-[1100px]" hidden={!loading}>
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
        <div className="mt-8 flex flex-col" hidden={!documents.length || loading}>
          <div
            className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8"
            hidden={!documents.length || loading}>
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Title
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Recipients
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Created
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredDocuments.map((document: any, index: number) => (
                      <tr
                        key={document.id}
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={(event) => showDocument(document.id)}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.title || "#" + document.id}
                        </td>
                        <td className="inline-flex max-w-[250px] flex-wrap gap-x-2 gap-y-1 whitespace-nowrap py-3 text-sm text-gray-500">
                          {document.Recipient.map((item: any) => (
                            <div key={item.id}>
                              {item.sendStatus === "NOT_SENT" ? (
                                <span
                                  id="sent_icon"
                                  className="inline-flex h-6 flex-shrink-0 items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  {item.name ? item.name + " <" + item.email + ">" : item.email}
                                </span>
                              ) : (
                                ""
                              )}
                              {item.sendStatus === "SENT" && item.readStatus !== "OPENED" ? (
                                <span id="sent_icon">
                                  <span
                                    id="sent_icon"
                                    className="inline-flex h-6 flex-shrink-0 items-center rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                    <EnvelopeIcon className="mr-1 inline h-4"></EnvelopeIcon>
                                    {item.name ? item.name + " <" + item.email + ">" : item.email}
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
                                    className="inline-flex h-6 flex-shrink-0 items-center rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                    <CheckIcon className="-mr-2 inline h-4"></CheckIcon>
                                    <CheckIcon className="mr-1 inline h-4"></CheckIcon>
                                    {item.name ? item.name + " <" + item.email + ">" : item.email}
                                  </span>
                                </span>
                              ) : (
                                ""
                              )}
                              {item.signingStatus === "SIGNED" ? (
                                <span id="signed_icon">
                                  <span className="inline-flex h-6 flex-shrink-0 items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                    <CheckBadgeIcon className="mr-1 inline h-5"></CheckBadgeIcon>{" "}
                                    {item.email}
                                  </span>
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
                            <small hidden={document.Recipient.length === 0}>
                              {document.Recipient.filter((r: any) => r.signingStatus === "SIGNED")
                                .length || 0}
                              /{document.Recipient.length || 0}
                            </small>
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(document.created).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div>
                            <IconButton
                              icon={PencilSquareIcon}
                              className="mr-2"
                              onClick={(event: any) => {
                                event.preventDefault();
                                event.stopPropagation();
                                router.push("/documents/" + document.id);
                              }}
                              disabled={document.status === "COMPLETED"}
                            />
                            <IconButton
                              icon={ArrowDownTrayIcon}
                              className="mr-2"
                              onClick={(event: any) => {
                                event.preventDefault();
                                event.stopPropagation();
                                router.push("/api/documents/" + document.id);
                              }}
                            />
                            <IconButton
                              icon={TrashIcon}
                              onClick={(event: any) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (confirm("Are you sure you want to delete this document")) {
                                  const documentsWithoutIndex = [...documents];
                                  const removedItem: any = documentsWithoutIndex.splice(index, 1);
                                  setDocuments(documentsWithoutIndex);
                                  deleteDocument(document.id)
                                    .catch((err) => {
                                      documentsWithoutIndex.splice(index, 0, removedItem);
                                      setDocuments(documentsWithoutIndex);
                                    })
                                    .then(() => {
                                      loadDocuments();
                                    });
                                }
                              }}></IconButton>
                            <span className="sr-only">, {document.name}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div hidden={filteredDocuments.length > 0} className="mx-auto mt-12 w-fit p-3">
                <FunnelIcon className="mr-1 inline w-5 align-middle" /> Nothing here. Maybe try a
                different filter.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-24 text-center" id="empty" hidden={documents.length > 0 || loading}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>

        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding a document. Any PDF will do.
        </p>
        <div className="mt-6">
          <Button
            icon={PlusIcon}
            disabled={!hasSubscription}
            onClick={() => {
              document?.getElementById("fileUploadHelper")?.click();
            }}>
            Add Document
          </Button>
          <input
            id="fileUploadHelper"
            type="file"
            accept="application/pdf"
            onChange={(event: any) => {
              uploadDocument(event);
            }}
            hidden
          />
        </div>
      </div>
      <ReactTooltip
        anchorId="empty"
        place="bottom"
        content="No preparation needed. Any PDF will do."
      />
    </>
  );
};

function formatDocumentStatus(status: DocumentStatus) {
  switch (status) {
    case DocumentStatus.DRAFT:
      return "Draft";

    case DocumentStatus.PENDING:
      return "Waiting for others";

    case DocumentStatus.COMPLETED:
      return "Completed";
  }
}

export async function getServerSideProps(context: NextPageContext) {
  const filter = context.query["filter"];

  return {
    props: {
      filter: filter || "ALL",
    },
  };
}

DocumentsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsPage;
