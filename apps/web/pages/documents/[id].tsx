import { ReactElement, useEffect } from "react";
import Layout from "../../components/layout";
import { NextPageWithLayout } from "../_app";
import { Document, Page, pdfjs } from "react-pdf";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("../../components/pdf-viewer"), {
  ssr: false,
});

const DocumentsDetailPage: NextPageWithLayout = () => {
  return (
    <div>
      <PDFViewer pdfUrl={"http://localhost:3000/api/documents/3"} />
    </div>
  );
};

DocumentsDetailPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsDetailPage;
