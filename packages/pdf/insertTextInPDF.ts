import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";

export async function insertTextInPDF(
  pdfAsBase64: string,
  text: string,
  positionX: number,
  positionY: number,
  page: number = 0
): Promise<string> {
  const fontBytes = fs.readFileSync("public/fonts/Qwigley-Regular.ttf");

  const existingPdfBytes = pdfAsBase64;

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();
  const pdfPage = pages[page];
  const textSize = 50;
  const textWidth = customFont.widthOfTextAtSize(text, textSize);
  const textHeight = customFont.heightAtSize(textSize);

  pdfPage.drawText(text, {
    x: pdfPage.getWidth() - positionX - textWidth / 2, // todo adjust for exact field size
    y: pdfPage.getHeight() - positionY - textHeight / 2, // todo adjust for exact field size
    size: textSize,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  const pdfAsUint8Array = await pdfDoc.save();
  return Buffer.from(pdfAsUint8Array).toString("base64");
}
