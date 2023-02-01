import { ReactElement, useEffect } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import { Document, Page, pdfjs } from "react-pdf";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import prisma from "@documenso/prisma";
import { getUserFromToken } from "@documenso/lib/server";
import Logo from "../../../components/logo";
import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import {
  BriefcaseIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

const PDFViewer = dynamic(() => import("../../../components/pdf-viewer"), {
  ssr: false,
});

const DocumentsDetailPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();

  return (
    <div className="mt-4">
      <div>
        <div>
          <nav className="sm:hidden" aria-label="Back">
            <a
              href="#"
              className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ChevronLeftIcon
                className="-ml-1 mr-1 h-5 w-5 flex-shrink-0 text-gray-400"
                aria-hidden="true"
              />
              Back
            </a>
          </nav>
          <nav className="hidden sm:flex" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-4">
              <li>
                <div className="flex">
                  <a
                    href="/documents"
                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Documents
                  </a>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <ChevronRightIcon
                    className="h-5 w-5 flex-shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  <a
                    href={
                      NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id
                    }
                    className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    "{props.document.title}"
                  </a>
                </div>
              </li>
            </ol>
          </nav>
        </div>
        <div className="mt-2 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {props.document.title}
            </h2>
            <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <UsersIcon
                  className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
                  aria-hidden="true"
                />
                {props?.document?.Recipient?.length} Recipients
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <InformationCircleIcon
                  className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
                  aria-hidden="true"
                />
                {formatDocumentStatus(props.document.status)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
            <Link
              type="a"
              href={
                NEXT_PUBLIC_WEBAPP_URL +
                "/documents/" +
                props.document.id +
                "/recipients"
              }
              className="ml-3 inline-flex items-center rounded-md border border-transparent bg-neon px-4 py-2 text-sm font-medium text-white shadow-sm bg-grey hover:bg-neon-dark focus:outline-none focus:ring-2 focus:neon-dark focus:ring-offset-2"
            >
              <UserPlusIcon className="inline text-white h-4 mr-1"></UserPlusIcon>
              Add Recipients
            </Link>
            <button
              type="button"
              disabled={(props?.document?.Recipient?.length || 0) === 0}
              onClick={() => {
                if (
                  confirm(
                    `Send document out to ${props?.document?.Recipient?.length} recipients?`
                  )
                ) {
                  alert();
                }
              }}
              className="ml-3 inline-flex items-center rounded-md border border-transparent bg-neon disabled:bg-gray-300 px-4 py-2 text-sm font-medium text-white shadow-sm bg-grey hover:bg-neon-dark focus:outline-none focus:ring-2 focus:neon-dark focus:ring-offset-2"
            >
              <PaperAirplaneIcon className="inline text-white w-4 mr-1"></PaperAirplaneIcon>
              Send
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto w-fit p-4">
        <PDFViewer
          pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
        />
      </div>
    </div>
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

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  const { id: documentId } = context.query;
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: +documentId,
    },
    include: {
      Recipient: true,
    },
  });

  // todo optimize querys
  // todo no intersection groups

  return {
    props: {
      document: document,
    },
  };
}

DocumentsDetailPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsDetailPage;
