import { Fragment, useState } from "react";
import EditableField from "./editable-field";
import SignableField from "./signable-field";
import { FieldType } from "@prisma/client";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";
import short from "short-uuid";

export default function PDFViewer(props) {
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageHeight, setPageHeight] = useState(0);

  function onPositionChangedHandler(position, id) {
    props.onPositionChanged(position, id);
  }

  function onDeleteHandler(id) {
    props.onDelete(id);
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
      <div
        hidden={loading}
        onMouseUp={props.onMouseUp}
        style={{ height: numPages * pageHeight + 1000 }}>
        <div className="mt-6 max-w-xs"></div>
        <Document
          file={props.pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          options={options}
          renderMode="canvas"
          className="absolute left-0 right-0 mx-auto w-auto">
          {Array.from({ length: numPages }, (_, index) => (
            <Fragment key={short.generate().toString()}>
              <div
                onMouseDown={(e) => {
                  if (e.button === 0) props.onMouseDown(e, index);
                }}
                onMouseUp={(e) => {
                  if (e.button === 0) props.onMouseUp(e, index);
                }}
                key={short.generate().toString()}
                style={{
                  position: "relative",
                  ...props.style,
                }}
                className="mx-auto w-fit">
                <Page
                  className="mt-5"
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onLoadSuccess={(e) => {
                    if (e.height) setPageHeight(e.height);
                    setLoading(false);
                  }}
                  onRenderError={() => setLoading(false)}></Page>
                {props?.fields
                  .filter((field) => field.page === index)
                  .map((field) =>
                    props.readonly ? (
                      <SignableField
                        onClick={props.onClick}
                        key={field.id}
                        field={field}
                        className="absolute"
                        onDelete={onDeleteHandler}></SignableField>
                    ) : (
                      <EditableField
                        hidden={
                          field.Signature ||
                          field.inserted ||
                          field.type === FieldType.FREE_SIGNATURE
                        }
                        key={field.id}
                        field={field}
                        className="absolute"
                        onPositionChanged={onPositionChangedHandler}
                        onDelete={onDeleteHandler}></EditableField>
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
