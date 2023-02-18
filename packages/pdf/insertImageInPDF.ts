import { degrees, PDFDocument, PDFImage, rgb, StandardFonts } from "pdf-lib";

export async function insertImageInPDF(
  pdfAsBase64: string,
  image: string | Uint8Array | ArrayBuffer,
  positionX: number,
  positionY: number,
  page: number = 0
): Promise<string> {
  const existingPdfBytes = pdfAsBase64;
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const pdfPage = pages[page];
  const pngImage = await pdfDoc.embedPng(image);

  pdfPage.drawImage(pngImage, {
    x: positionX,
    y: positionY,
    width: pngImage.width,
    height: pngImage.height,
  });

  const pdfAsUint8Array = await pdfDoc.save();
  return Buffer.from(pdfAsUint8Array).toString("base64");
}
