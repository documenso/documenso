import { DateTime } from 'luxon';
import type { Browser } from 'playwright';
import { chromium } from 'playwright';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { encryptSecondaryData } from '../crypto/encrypt';

export type GetCertificatePdfOptions = {
  documentId: number;
};

export const getCertificatePdf = async ({ documentId }: GetCertificatePdfOptions) => {
  const encryptedId = encryptSecondaryData({
    data: documentId.toString(),
    expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
  });

  let browser: Browser;

  if (process.env.NEXT_PRIVATE_BROWSERLESS_URL) {
    // !: Use CDP rather than the default `connect` method to avoid coupling to the playwright version.
    // !: Previously we would have to keep the playwright version in sync with the browserless version to avoid errors.
    browser = await chromium.connectOverCDP(process.env.NEXT_PRIVATE_BROWSERLESS_URL);
  } else {
    browser = await chromium.launch();
  }

  if (!browser) {
    throw new Error(
      'Failed to establish a browser, please ensure you have either a Browserless.io url or chromium browser installed',
    );
  }

  const page = await browser.newPage();

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encryptedId}`, {
    waitUntil: 'networkidle',
    timeout: 10_000,
  });

  const result = await page.pdf({
    format: 'A4',
  });

  void browser.close();

  return result;
};
