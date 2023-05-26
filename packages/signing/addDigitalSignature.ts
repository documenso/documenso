import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from "pdf-lib";


const fs = require("fs");
// Local copy of Node SignPDF because https://github.com/vbuch/node-signpdf/pull/187 was not published in NPM yet. Can be switched to npm packge.
const signer = require("./node-signpdf/dist/signpdf");

export const addDigitalSignature = async (documentAsBase64: string): Promise<string> => {
  // Custom code to add Byterange to PDF
  const PDFArrayCustom = require("./PDFArrayCustom");
  const pdfBuffer = Buffer.from(documentAsBase64, "base64");
  const p12Buffer = fs.readFileSync(process.env.CERT_FILE_PATH || "ressources/cert.p12");
  const SIGNATURE_LENGTH = 12000;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  const ByteRange = PDFArrayCustom.withContext(pdfDoc.context);
  ByteRange.push(PDFNumber.of(0));
  ByteRange.push(PDFName.of(signer.DEFAULT_BYTE_RANGE_PLACEHOLDER));
  ByteRange.push(PDFName.of(signer.DEFAULT_BYTE_RANGE_PLACEHOLDER));
  ByteRange.push(PDFName.of(signer.DEFAULT_BYTE_RANGE_PLACEHOLDER));

  const signatureDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange,
    Contents: PDFHexString.of("A".repeat(SIGNATURE_LENGTH)),
    Reason: PDFString.of("Signed by Documenso"),
    M: PDFString.fromDate(new Date()),
  });
  const signatureDictRef = pdfDoc.context.register(signatureDict);

  const widgetDict = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: [0, 0, 0, 0],
    V: signatureDictRef,
    T: PDFString.of("Signature1"),
    F: 4,
    P: pages[0].ref,
  });
  const widgetDictRef = pdfDoc.context.register(widgetDict);

  // Add signature widget to the first page
  pages[0].node.set(PDFName.of("Annots"), pdfDoc.context.obj([widgetDictRef]));

  // Create an AcroForm object containing the signature widget
  pdfDoc.catalog.set(
    PDFName.of("AcroForm"),
    pdfDoc.context.obj({
      SigFlags: 3,
      Fields: [widgetDictRef],
    })
  );

  const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const modifiedPdfBuffer = Buffer.from(modifiedPdfBytes);

  const signObj = new signer.SignPdf();
  const signedPdfBuffer: Buffer = signObj.sign(modifiedPdfBuffer, p12Buffer, {
    passphrase: "",
  });

  return signedPdfBuffer.toString("base64");
};