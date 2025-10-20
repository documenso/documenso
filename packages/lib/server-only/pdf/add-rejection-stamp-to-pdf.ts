import type { PDFDocument } from '@cantoo/pdf-lib';
import { TextAlignment, rgb, setFontAndSize } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { getPageSize } from './get-page-size';

/**
 * Adds a rejection stamp to each page of a PDF document.
 * The stamp is placed in the center of the page.
 */
export async function addRejectionStampToPdf(
  pdfDoc: PDFDocument,
  reason: string,
): Promise<PDFDocument> {
  const pages = pdfDoc.getPages();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(
    async (res) => res.arrayBuffer(),
  );

  const font = await pdfDoc.embedFont(fontBytes, {
    customName: 'Noto',
  });

  const form = pdfDoc.getForm();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = getPageSize(page);

    // Draw the "REJECTED" text
    const rejectedTitleText = 'DOCUMENT REJECTED';
    const rejectedTitleFontSize = 36;
    const rejectedTitleTextField = form.createTextField(`internal-document-rejected-title-${i}`);

    if (!rejectedTitleTextField.acroField.getDefaultAppearance()) {
      rejectedTitleTextField.acroField.setDefaultAppearance(
        setFontAndSize('Noto', rejectedTitleFontSize).toString(),
      );
    }

    rejectedTitleTextField.updateAppearances(font);

    rejectedTitleTextField.setFontSize(rejectedTitleFontSize);
    rejectedTitleTextField.setText(rejectedTitleText);
    rejectedTitleTextField.setAlignment(TextAlignment.Center);

    const rejectedTitleTextWidth =
      font.widthOfTextAtSize(rejectedTitleText, rejectedTitleFontSize) * 1.2;
    const rejectedTitleTextHeight = font.heightAtSize(rejectedTitleFontSize);

    // Calculate the center position of the page
    const centerX = width / 2;
    const centerY = height / 2;

    // Position the title text at the center of the page
    const rejectedTitleTextX = centerX - rejectedTitleTextWidth / 2;
    const rejectedTitleTextY = centerY - rejectedTitleTextHeight / 2;

    // Add padding for the rectangle
    const padding = 20;

    // Draw the stamp background
    page.drawRectangle({
      x: rejectedTitleTextX - padding / 2,
      y: rejectedTitleTextY - padding / 2,
      width: rejectedTitleTextWidth + padding,
      height: rejectedTitleTextHeight + padding,
      borderColor: rgb(220 / 255, 38 / 255, 38 / 255),
      borderWidth: 4,
    });

    rejectedTitleTextField.addToPage(page, {
      x: rejectedTitleTextX,
      y: rejectedTitleTextY,
      width: rejectedTitleTextWidth,
      height: rejectedTitleTextHeight,
      textColor: rgb(220 / 255, 38 / 255, 38 / 255),
      backgroundColor: undefined,
      borderWidth: 0,
      borderColor: undefined,
    });
  }

  return pdfDoc;
}
