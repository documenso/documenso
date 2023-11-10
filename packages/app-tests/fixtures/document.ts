import { type Page } from '@playwright/test';

type uploadDocumentsOption = {
  pdf: Buffer;
  pdfName: string;
};

export const createDocumentsFixture = (page: Page) => {
  return {
    upload: async ({ pdf, pdfName }: uploadDocumentsOption) => {
      await page.getByTestId('document-dropzone').setInputFiles({
        buffer: pdf,
        mimeType: 'application/pdf',
        name: pdfName,
      });
    },
  };
};
