import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import React from "react";

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFEditor(props: any) {
  const router = useRouter();

  return (
    <PDFViewer
      document={props.document}
      pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}`}
    />
  );
}
