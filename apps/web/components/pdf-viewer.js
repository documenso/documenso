import { useState } from "react";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";

export default function PDFViewer(props) {
  const [file, setFile] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);

  function onFileChange(event) {
    setFile(event.target.files[0]);
  }

  function onDocumentLoadSuccess({ numPages: nextNumPages }) {
    setNumPages(nextNumPages);
  }

  const options = {
    cMapUrl: "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "standard_fonts/",
  };

  return (
    <>
      <div hidden={loading}>
        <Document
          file={props.pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          options={options}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              className="mt-5"
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onLoadSuccess={() => setLoading(false)}
              onRenderError={() => setLoading(false)}
            />
          ))}
        </Document>
      </div>
      <div className="mt-10" hidden={!loading}>
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
    </>
  );
}
