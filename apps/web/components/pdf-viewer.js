import { useState } from "react";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";

export default function PDFViewer() {
  const [numPages, setNumPages] = useState(null);

  function onDocumentLoadSuccess({ numPages: nextNumPages }) {
    setNumPages(nextNumPages);
  }

  return (
    <>
      <Document
        file="/sample.pdf"
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={(err) => {
          console.error(err);
        }}
        onSourceError={(err) => {
          console.error(err);
        }}
        onLoadProgress={(err) => {
          console.error(err);
        }}
        onPassword={(err) => {
          console.error(err);
        }}
      >
        <Page pageNumber={1} />
      </Document>
    </>
  );
}
