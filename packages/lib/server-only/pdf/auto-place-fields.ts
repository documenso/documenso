import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import PDFParser from 'pdf2json';

import { getPageSize } from './get-page-size';

type TextPosition = {
  text: string;
  x: number;
  y: number;
  w: number;
};

type CharIndexMapping = {
  textPosIndex: number;
};

type PlaceholderInfo = {
  placeholder: string;
  fieldType: string;
  recipient: string;
  isRequired: string;
  page: number;
  // PDF2JSON coordinates (in page units - these are relative to page dimensions)
  x: number;
  y: number;
  width: number;
  height: number;
  // Page dimensions from PDF2JSON (in page units)
  pageWidth: number;
  pageHeight: number;
};

/*
  Questions for later:
    - Does it handle multi-page PDFs?
    - What happens with incorrect placeholders? E.g. those containing non-accepted properties.
    - The placeholder data is dynamic. How to handle this parsing? Perhaps we need to do it similar to the fieldMeta parsing.
*/

export const extractPlaceholdersFromPDF = async (pdf: Buffer): Promise<PlaceholderInfo[]> => {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);

    parser.on('pdfParser_dataError', (errData) => {
      reject(errData);
    });

    parser.on('pdfParser_dataReady', (pdfData) => {
      const placeholders: PlaceholderInfo[] = [];

      pdfData.Pages.forEach((page, pageIndex) => {
        /*
          pdf2json returns the PDF page content as an array of characters.
          We need to concatenate the characters to get the full text.
          We also need to get the position of the text so we can place the placeholders in the correct position.
          
          Page dimensions from PDF2JSON are in "page units" (relative coordinates)
        */
        const pageWidth = page.Width;
        const pageHeight = page.Height;

        let pageText = '';
        const textPositions: TextPosition[] = [];
        const charIndexToTextPos: CharIndexMapping[] = [];

        page.Texts.forEach((text) => {
          /*
            R is an array that contains objects with each character.
            The decodedText contains only the character, without any other information.

            textPositions stores each character and its position on the page.
          */
          const decodedText = text.R.map((run) => decodeURIComponent(run.T)).join('');

          for (let i = 0; i < decodedText.length; i++) {
            charIndexToTextPos.push({
              textPosIndex: textPositions.length,
            });
          }

          pageText += decodedText;

          textPositions.push({
            text: decodedText,
            x: text.x,
            y: text.y,
            w: text.w || 0,
          });
        });

        const placeholderMatches = pageText.matchAll(/{{([^}]+)}}/g);

        for (const match of placeholderMatches) {
          const placeholder = match[0];
          const placeholderData = match[1].split(',').map((part) => part.trim());

          const [fieldType, recipient, isRequired] = placeholderData;

          /*
            Find the position of where the placeholder starts in the text

            Then find the position of where the placeholder ends in the text by adding the length of the placeholder to the index of the placeholder.
          */
          const matchIndex = match.index;
          const placeholderLength = placeholder.length;
          const placeholderEndIndex = matchIndex + placeholderLength;

          const startCharInfo = charIndexToTextPos[matchIndex];
          const endCharInfo = charIndexToTextPos[placeholderEndIndex - 1];

          if (!startCharInfo || !endCharInfo) {
            console.error('Could not find text position for placeholder', placeholder);

            return;
          }

          const startTextPos = textPositions[startCharInfo.textPosIndex];
          const endTextPos = textPositions[endCharInfo.textPosIndex];

          /* 
            PDF2JSON coordinates - these are in "page units" (relative coordinates)
            Calculate width as the distance from start to end, plus a portion of the last character's width
            Use 10% of the last character width to avoid extending too far beyond the placeholder
          */
          const x = startTextPos.x;
          const y = startTextPos.y;
          const width = endTextPos.x + endTextPos.w * 0.1 - startTextPos.x;

          placeholders.push({
            placeholder,
            fieldType,
            recipient,
            isRequired,
            page: pageIndex + 1,
            x,
            y,
            width,
            height: 1,
            pageWidth,
            pageHeight,
          });
        }
      });

      resolve(placeholders);
    });

    parser.parseBuffer(pdf);
  });
};

export const replacePlaceholdersInPDF = async (pdf: Buffer): Promise<Buffer> => {
  const placeholders = await extractPlaceholdersFromPDF(pdf);

  const pdfDoc = await PDFDocument.load(new Uint8Array(pdf));
  const pages = pdfDoc.getPages();

  for (const placeholder of placeholders) {
    const pageIndex = placeholder.page - 1;
    const page = pages[pageIndex];

    const { width: pdfLibPageWidth, height: pdfLibPageHeight } = getPageSize(page);

    /*
      Convert PDF2JSON coordinates to pdf-lib coordinates:
      
      PDF2JSON uses relative "page units":
      - x, y, width, height are in page units
      - Page dimensions (Width, Height) are also in page units
      
      pdf-lib uses absolute points (1 point = 1/72 inch):
      - Need to convert from page units to points
      - Y-axis in pdf-lib is bottom-up (origin at bottom-left)
      - Y-axis in PDF2JSON is top-down (origin at top-left)
      
      Conversion formulas:
      - x_points = (x / pageWidth) * pdfLibPageWidth
      - y_points = pdfLibPageHeight - ((y / pageHeight) * pdfLibPageHeight)
      - width_points = (width / pageWidth) * pdfLibPageWidth
      - height_points = (height / pageHeight) * pdfLibPageHeight
    */

    const xPoints = (placeholder.x / placeholder.pageWidth) * pdfLibPageWidth;
    const yPoints = pdfLibPageHeight - (placeholder.y / placeholder.pageHeight) * pdfLibPageHeight;
    const widthPoints = (placeholder.width / placeholder.pageWidth) * pdfLibPageWidth;
    const heightPoints = (placeholder.height / placeholder.pageHeight) * pdfLibPageHeight;

    page.drawRectangle({
      x: xPoints,
      y: yPoints - heightPoints, // Adjust for height since y is at baseline
      width: widthPoints,
      height: heightPoints,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 2,
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();

  return Buffer.from(modifiedPdfBytes);
};
