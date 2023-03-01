const signer = require("../../node_modules/node-signpdf/dist/signpdf");
const {
  pdfkitAddPlaceholder,
} = require("../../node_modules/node-signpdf/dist/helpers/pdfkitAddPlaceholder");
import * as fs from "fs";

export const signDocument = (documentAsBase64: string): any => {
  const pdfBuffer = Buffer.from(documentAsBase64, "base64");
  const certBuffer = fs.readFileSync("public/certificate.p12");

  console.log("adding placeholder..");
  console.log(signer.pdfkitAddPlaceholder);
  const inputBuffer = signer.pdfkitAddPlaceholder({
    pdfBuffer,
    reason: "Signed Certificate.",
    contactInfo: "sign@example.com",
    name: "Example",
    location: "Jakarta",
    signatureLength: certBuffer.length,
  });

  console.log("signing..");
  const signedPdf = new signer.SignPdf().sign(inputBuffer, certBuffer);

  return signedPdf;
};
