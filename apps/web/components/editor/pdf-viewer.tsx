import React, { Fragment, useState, MouseEvent, MouseEventHandler } from "react";
import EditableField from "./editable-field";
import SignableField from "./signable-field";
import { FieldType } from "@prisma/client";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";
import short from "short-uuid";

interface IProps {
  onPositionChanged: (position: any, id: any) => void,
  onDelete: (id: any) => void,
  pdfUrl: string,
  onMouseUp: MouseEventHandler<HTMLDivElement>,
  onMouseDown: React.MouseEventHandler<HTMLDivElement>,
  style?: any,
  fields: any,
  onClick: any,
  readonly: boolean,
}

export default function PDFViewer(props: IProps) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageHeight, setPageHeight] = useState(0);

  const onPositionChangedHandler = (position: any, id: any) => {
    props.onPositionChanged(position, id);
  }

  const onDeleteHandler = (id: any) => {
    props.onDelete(id);
  }

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }: {
    numPages: any;
  }) => {
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
                  if (e.button === 0) props.onMouseDown(e);
                }}
                onMouseUp={(e) => {
                  if (e.button === 0) props.onMouseUp(e);
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
                  .filter((field: any) => field.page === index)
                  .map((field: any) =>
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
                        className="true"
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
            {[...Array(6)].map((_, index) => (
              <div className="ph-row" key={index}>
                <div className="ph-col-6 big"></div>
                <div className="ph-col-4 empty big"></div>
                <div className="ph-col-2 big"></div>
                <div className="ph-col-4"></div>
                <div className="ph-col-8 empty"></div>
                <div className="ph-col-6"></div>
                <div className="ph-col-6 empty"></div>
                <div className="ph-col-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
