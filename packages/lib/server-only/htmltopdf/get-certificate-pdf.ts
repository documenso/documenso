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
    console.log('here');
    browser = await chromium.launch();
    console.log('here2');
  }

  if (!browser) {
    throw new Error(
      'Failed to establish a browser, please ensure you have either a Browserless.io url or chromium browser installed',
    );
  }

  console.log('1');
  const page = await browser.newPage();
  console.log('2');

  const domcontentloadedTime = Date.now();
  console.log('domcontentloadedTime:' + domcontentloadedTime);

  await page
    .goto(`${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encryptedId}`, {
      waitUntil: 'domcontentloaded',
    })
    .catch((e) => {
      console.log(e);
    });
  console.log('domcontentloadedEnd:' + (Date.now() - domcontentloadedTime));

  const networkidleTime = Date.now();
  console.log('networkidleTime:' + networkidleTime);

  await page
    .goto(`${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encryptedId}`, {
      waitUntil: 'networkidle',
    })
    .catch((e) => {
      console.log(e);
    });
  console.log('networkidleEnd:' + (Date.now() - networkidleTime));

  const result = await page.pdf({
    format: 'A4',
  });
  console.log(4);

  void browser.close();

  console.log(5);
  return result;
};
