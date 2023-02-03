import { ReactElement } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import { getUserFromToken } from "@documenso/lib/server";
import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";
import { Button, Breadcrumb } from "@documenso/ui";

const PDFViewer = dynamic(() => import("../../../components/pdf-viewer"), {
  ssr: false,
});

const DocumentsDetailPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();

  return (
    <div className="mt-4">
      <div>
        <div>
          <Breadcrumb
            document={props.document}
            items={[
              {
                title: "Documents",
                href: "/documents",
              },
              {
                title: props.document.title,
                href:
                  NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id,
              },
            ]}
          />
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
            <Button
              icon={UserPlusIcon}
              href={
                NEXT_PUBLIC_WEBAPP_URL +
                "/documents/" +
                props.document.id +
                "/recipients"
              }
            >
              Add Recipients
            </Button>
            <Button
              icon={PaperAirplaneIcon}
              disabled={(props?.document?.Recipient?.length || 0) === 0}
              className="ml-3"
              onClick={() => {
                if (
                  confirm(
                    `Send document out to ${props?.document?.Recipient?.length} recipients?`
                  )
                ) {
                }
              }}
            >
              Send
            </Button>
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

  const document: PrismaDocument = await getDocument(
    +documentId,
    context.req,
    context.res
  );

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
