import { PDFDocument } from 'pdf-lib';

export async function insertImageInPDF(
  pdfAsBase64: string,
  image: string | Uint8Array | ArrayBuffer,
  positionX: number,
  positionY: number,
  page = 0,
): Promise<string> {
  const existingPdfBytes = pdfAsBase64;
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const pdfPage = pages[page];
  const pngImage = await pdfDoc.embedPng(image);
  const drawSize = { width: 192, height: 64 };

  pdfPage.drawImage(pngImage, {
    x: positionX,
    y: pdfPage.getHeight() - positionY - drawSize.height,
    width: drawSize.width,
    height: drawSize.height,
  });

  const pdfAsUint8Array = await pdfDoc.save();
  return Buffer.from(pdfAsUint8Array).toString('base64');
}
