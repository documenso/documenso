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

  // Inject CSS to ensure audit log cards fit properly in PDF
  await page.addStyleTag({
    content: `
      @media print {
        .audit-log-container {
          space-y: 4 !important;
        }
        
        .audit-log-card {
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-bottom: 1rem !important;
        }
        
        .audit-log-card:not(:first-child) {
          margin-top: 2rem !important;
        }
        
        .audit-log-grid {
          display: grid !important;
          grid-template-columns: repeat(12, 1fr) !important;
          gap: 1rem !important;
        }
        
        .audit-log-section {
          display: flex !important;
          flex-direction: column !important;
        }
        
        .audit-log-section.col-span-4 {
          grid-column: span 4 / span 4 !important;
        }
        
        .audit-log-label {
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin-bottom: 0.25rem !important;
        }
        
        .audit-log-value {
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        
        .audit-log-value.font-mono {
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace !important;
        }
        
        .audit-log-value.font-medium {
          font-weight: 500 !important;
        }
        
        .audit-log-value.break-words {
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        
        .audit-log-value.leading-relaxed {
          line-height: 1.625 !important;
        }
        
        .text-background {
          color: #000000 !important;
        }
        
        .text-muted-foreground {
          color: #6b7280 !important;
        }
        
        .space-y-3 > * + * {
          margin-top: 0.75rem !important;
        }
        
        .space-y-1 > * + * {
          margin-top: 0.25rem !important;
        }
        
        .mb-2 {
          margin-bottom: 0.5rem !important;
        }
        
        .mt-1 {
          margin-top: 0.25rem !important;
        }
        
        .p-4 {
          padding: 1rem !important;
        }
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
