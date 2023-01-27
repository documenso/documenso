import { useSession } from "next-auth/react";
import { ReactElement, useEffect, useState } from "react";
import Layout from "../components/layout";
import type { NextPageWithLayout } from "./_app";
import Head from "next/head";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/router";
import { uploadDocument } from "@documenso/features";
import { DocumentStatus } from "@prisma/client";

const DocumentsPage: NextPageWithLayout = (req, res) => {
  const router = useRouter();
  const [documents = [], setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocuments();
  }, []);

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
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-neon px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neon-dark focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
              onClick={() => {
                document?.getElementById("fileUploadHelper")?.click();
              }}
            >
              Add Document
            </button>
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
                          {document.recipients || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDocumentStatus(document.status)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            href={"/documents/" + document.id}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
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
          <button
            type="button"
            onClick={() => {
              document?.getElementById("fileUploadHelper")?.click();
            }}
            className="inline-flex items-center rounded-md border border-transparent bg-neon px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Upload Document
          </button>
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
