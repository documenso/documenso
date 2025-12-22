import { DateTime } from 'luxon';
import type { Browser } from 'playwright';

import {
  NEXT_PRIVATE_INTERNAL_WEBAPP_URL,
  NEXT_PUBLIC_WEBAPP_URL,
  USE_INTERNAL_URL_BROWSERLESS,
} from '../../constants/app';
import { type SupportedLanguageCodes, isValidLanguageCode } from '../../constants/i18n';
import { env } from '../../utils/env';
import { encryptSecondaryData } from '../crypto/encrypt';

export type GetCertificatePdfOptions = {
  documentId: number;
  // eslint-disable-next-line @typescript-eslint/ban-types
  language?: SupportedLanguageCodes | (string & {});
};

export const getCertificatePdf = async ({ documentId, language }: GetCertificatePdfOptions) => {
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
      name: 'lang',
      value: lang,
      url: USE_INTERNAL_URL_BROWSERLESS()
        ? NEXT_PUBLIC_WEBAPP_URL()
        : NEXT_PRIVATE_INTERNAL_WEBAPP_URL(),
    },
  ]);

  await page.goto(
    `${USE_INTERNAL_URL_BROWSERLESS() ? NEXT_PUBLIC_WEBAPP_URL() : NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/__htmltopdf/certificate?d=${encryptedId}`,
    {
      waitUntil: 'networkidle',
      timeout: 10_000,
    },
  );

  // !: This is a workaround to ensure the page is loaded correctly.
  // !: It's not clear why but suddenly browserless cdp connections would
  // !: cause the page to render blank until a reload is performed.
  await page.reload({
    waitUntil: 'networkidle',
    timeout: 10_000,
  });

  await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 10_000,
  });

  const result = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browserContext.close();

  void browser.close();

  return result;
};
