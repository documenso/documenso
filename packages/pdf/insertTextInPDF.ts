import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";

export async function insertTextInPDF(
  pdfAsBase64: string,
  text: string,
  positionX: number,
  positionY: number,
  page: number = 0,
  useHandwritingFont = true
): Promise<string> {
  const fontBytes = fs.readFileSync("public/fonts/Qwigley-Regular.ttf");

  const existingPdfBytes = pdfAsBase64;

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const pdfPage = pages[page];
  const textSize = useHandwritingFont ? 50 : 15;
  const textWidth = customFont.widthOfTextAtSize(text, textSize);
  const textHeight = customFont.heightAtSize(textSize);
  const fieldSize = { width: 192, height: 64 };
  const invertedYPosition = pdfPage.getHeight() - positionY - fieldSize.height;

  pdfPage.drawText(text, {
    x: positionX,
    y: invertedYPosition,
    size: textSize,
    font: useHandwritingFont ? customFont : helveticaFont,
    color: rgb(0, 0, 0),
  });

  const pdfAsUint8Array = await pdfDoc.save();
  return Buffer.from(pdfAsUint8Array).toString("base64");
}
