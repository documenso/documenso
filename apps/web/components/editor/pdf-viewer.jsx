import { Fragment, useState } from "react";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";
import EditableField from "./editable-field";
import ReadOnlyField from "./readonly-field";
import short from "short-uuid";

export default function PDFViewer(props) {
  const [file, setFile] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);

  function onPositionChangedHandler(position, id) {
    props.onPositionChanged(position, id);
  }

  function onDeleteHandler(id) {
    props.onDelete(id);
  }

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
        <div className="max-w-xs mt-6"></div>
        <Document
          file={props.pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          options={options}
          renderMode="canvas"
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Fragment key={short.generate().toString()}>
              <div
                onMouseDown={(e) => {
                  props.onMouseDown(e, index);
                }}
                key={short.generate().toString()}
                style={{
                  position: "relative",
                  cursor: 'url("https://place-hold.it/110x64"), auto',
                }}
                className="mx-auto w-fit"
              >
                <Page
                  className="mt-5"
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onLoadSuccess={() => setLoading(false)}
                  onRenderError={() => setLoading(false)}
                ></Page>
                {props?.fields
                  .filter((item) => item.page === index)
                  .map((item) =>
                    props.readonly ? (
                      <ReadOnlyField
                        onClick={props.onClick}
                        key={item.id}
                        field={item}
                        className="absolute"
                      ></ReadOnlyField>
                    ) : (
                      <EditableField
                        hidden={item.Signature}
                        key={item.id}
                        field={item}
                        className="absolute"
                        onPositionChanged={onPositionChangedHandler}
                        onDelete={onDeleteHandler}
                      ></EditableField>
                    )
                  )}
              </div>
            </Fragment>
          ))}
        </Document>
      </div>
      <div className="mx-auto mt-10 w-[600px]" hidden={!loading}>
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
