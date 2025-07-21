import { DateTime } from 'luxon';
import type { Browser } from 'playwright';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { type SupportedLanguageCodes, isValidLanguageCode } from '../../constants/i18n';
import { env } from '../../utils/env';
import { encryptSecondaryData } from '../crypto/encrypt';

export type GetAuditLogPdfOptions = {
  documentId: number;
  // eslint-disable-next-line @typescript-eslint/ban-types
  language?: SupportedLanguageCodes | (string & {});
};

export const getAuditLogPdf = async ({ documentId, language }: GetAuditLogPdfOptions) => {
  const { chromium } = await import('playwright');

  const encryptedId = encryptSecondaryData({
    data: documentId.toString(),
    expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
  });

  let browser: Browser;

  const browserlessUrl = env('NEXT_PRIVATE_BROWSERLESS_URL');

  if (browserlessUrl) {
    // !: Use CDP rather than the default `connect` method to avoid coupling to the playwright version.
    // !: Previously we would have to keep the playwright version in sync with the browserless version to avoid errors.
    browser = await chromium.connectOverCDP(browserlessUrl);
  } else {
    browser = await chromium.launch();
  }

  if (!browser) {
    throw new Error(
      'Failed to establish a browser, please ensure you have either a Browserless.io url or chromium browser installed',
    );
  }

  const browserContext = await browser.newContext();

  const page = await browserContext.newPage();

  const lang = isValidLanguageCode(language) ? language : 'en';

  await page.context().addCookies([
    {
      name: 'language',
      value: lang,
      url: NEXT_PUBLIC_WEBAPP_URL(),
    },
  ]);

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/audit-log?d=${encryptedId}`, {
    waitUntil: 'networkidle',
    timeout: 10_000,
  });

  // Inject CSS to ensure table fits properly in PDF
  await page.addStyleTag({
    content: `
      @media print {
        table {
          width: 100% !important;
          table-layout: fixed !important;
          font-size: 10px !important;
        }
        th, td {
          padding: 4px !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          line-height: 1.2 !important;
        }
        th:nth-child(1) { width: 15%; }
        th:nth-child(2) { width: 20%; }
        th:nth-child(3) { width: 25%; }
        th:nth-child(4) { width: 20%; }
        th:nth-child(5) { width: 20%; }
      }
    `,
  });

  const result = await page.pdf({
    format: 'A4',
    margin: {
      top: '8mm',
      right: '8mm',
      bottom: '8mm',
      left: '8mm',
    },
    printBackground: true,
    preferCSSPageSize: true,
    scale: 0.9,
  });

  await browserContext.close();

  void browser.close();

  return result;
};
