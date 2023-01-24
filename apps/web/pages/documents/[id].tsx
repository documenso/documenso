import { ReactElement, useEffect } from "react";
import Layout from "../../components/layout";
import { NextPageWithLayout } from "../_app";
import { Document, Page, pdfjs } from "react-pdf";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";

const PDFViewer = dynamic(() => import("../../components/pdf-viewer"), {
  ssr: false,
});

const DocumentsDetailPage: NextPageWithLayout = () => {
  const router = useRouter();

  return (
    <div className="mx-auto w-fit overflow-scroll">
      <PDFViewer
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
      />
    </div>
  );
};

DocumentsDetailPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsDetailPage;
