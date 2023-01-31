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

const PDFViewer = dynamic(() => import("../../../components/pdf-viewer"), {
  ssr: false,
});

const DocumentsDetailPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();

  return (
    <div className="mx-auto w-fit p-4">
      <div className="mx-auto w-auto text-left">
        <div>
          <h3 className="font-medium leading-tight text-3xl mt-0 mb-2 text-neon">
            {props.document.title}
          </h3>
          <Link
            type="a"
            href={
              NEXT_PUBLIC_WEBAPP_URL +
              "/documents/" +
              props.document.id +
              "/recipients"
            }
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-neon px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neon-dark focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Signers
          </Link>
        </div>
      </div>
      <div className="">
        <PDFViewer
          pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
        />
      </div>
    </div>
  );
};

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  const { id: documentId } = context.query;
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: +documentId,
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
