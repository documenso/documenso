import { Fragment, useState } from "react";
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5";
import Field from "./field";
import short from "short-uuid";
import { Button } from "@documenso/ui";
const stc = require("string-to-color");

export default function PDFViewer(props) {
  const [file, setFile] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState([]);

  function onPositionChangedHandler(position, id) {
    if (!position) return;
    const newFields = [...fields];
    fields.find((e) => e.id == id).position = position;
    // setFields(newFields);
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
        <div className="max-w-xs mt-6">
          <select
            className="mb-3 inline mt-1 w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            style={{ background: stc(selectedValue) }}
            defaultValue={props?.document?.Recipient[0]}
            value={selectedValue}
            selectedIndex={0}
            onChange={(e) => setSelectedValue(e.target.value)}
          >
            {props?.document?.Recipient?.map((item) => (
              <option
                key={item.email + short.generate().toString()}
                style={{
                  background: stc(
                    item.name ? `${item.name} <${item.email}>` : item.email
                  ),
                }}
              >
                {item.name ? `${item.name} <${item.email}>` : item.email}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="inline ml-1"
          onClick={() => {
            setFields(
              fields.concat({
                id: short.generate().toString(),
                type: "signature",
                position: { x: 0, y: -842 },
                recipient: selectedValue,
              })
            );
          }}
        >
          Add Signature Field
        </Button>
        <Button color="secondary" className="inline ml-1">
          Add Date Field
        </Button>
        <Button color="secondary" className="inline ml-1">
          Add Text Field
        </Button>
        <Document
          file={props.pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          options={options}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Fragment key={short.generate().toString()}>
              <div
                key={short.generate().toString()}
                style={{
                  position: "relative",
                  background: "green",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    background: "red",
                  }}
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
                  {fields.map((item) => (
                    <Field
                      key={item.id}
                      field={item}
                      className="absolute"
                      onPositionChangedHandler={onPositionChangedHandler}
                    ></Field>
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </Document>
      </div>
      <div className="mt-10 w-[600px]" hidden={!loading}>
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
