import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta, Envelope, RecipientRole } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { UAParser } from 'ua-parser-js';

import { DOCUMENT_STATUS } from '../../constants/document';
import { APP_I18N_OPTIONS } from '../../constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../constants/recipient-roles';
import type { TDocumentAuditLog } from '../../types/document-audit-logs';
import { formatDocumentAuditLogAction } from '../../utils/document-audit-logs';
import { ensureFontLibrary } from './helpers';

export type AuditLogRecipient = {
  id: number;
  name: string;
  email: string;
  role: RecipientRole;
};

type GenerateAuditLogsOptions = {
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeItems: string[];
  recipients: AuditLogRecipient[];
  auditLogs: TDocumentAuditLog[];
  hidePoweredBy: boolean;
  pageWidth: number;
  pageHeight: number;
  i18n: I18n;
  envelopeOwner: {
    email: string;
    name: string;
  };
};

const parser = new UAParser();

const textForeground = '#000';
const textMutedForeground = '#64748B';
const textMutedForegroundLight = '#929DAE';
const hairlineColor = '#E5E7EB';

const fontMedium = '500';
const fontSemibold = '600';

const textXs = 8;
const textSm = 9.5;

const pageMarginX = 48;
const pageTopMargin = 56;
const pageBottomMargin = 64;
const contentMaxWidth = 640;

const titleFontSize = 18;
const headerGap = 24;
const sectionGap = 28;

const timeColumnWidth = 88;
const rowColumnGap = 20;
const rowVerticalPadding = 10;

type RenderedRow = {
  group: Konva.Group;
  height: number;
};

type RenderFieldOptions = {
  label: string;
  text: string | string[];
  width: number;
  x?: number;
  wrapChar?: boolean;
};

/**
 * A single description-list field: a small muted label above its value(s).
 */
const renderField = (options: RenderFieldOptions) => {
  const { label, text, width, x, wrapChar } = options;

  const group = new Konva.Group({
    x: x ?? 0,
  });

  const labelText = new Konva.Text({
    text: label,
    fontFamily: 'Inter',
    fontSize: textXs,
    fontStyle: fontMedium,
    fill: textMutedForeground,
  });

  group.add(labelText);

  const values = typeof text === 'string' ? [text] : text;

  let y = labelText.height() + 5;

  for (const value of values) {
    const valueText = new Konva.Text({
      y,
      width,
      text: value,
      fontFamily: 'Inter',
      fontSize: textSm,
      lineHeight: 1.4,
      fill: textForeground,
      wrap: wrapChar ? 'char' : 'word',
    });

    group.add(valueText);

    y += valueText.height() + 3;
  }

  return group;
};

type RenderDocumentHeaderOptions = {
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  width: number;
  i18n: I18n;
};

/**
 * First page header: title with the document title underneath.
 */
const renderDocumentHeader = (options: RenderDocumentHeaderOptions) => {
  const { envelope, width, i18n } = options;

  const group = new Konva.Group();

  const title = new Konva.Text({
    text: i18n._(msg`Audit Log`),
    fontFamily: 'Inter',
    fontSize: titleFontSize,
    fontStyle: fontSemibold,
    letterSpacing: -0.2,
    fill: textForeground,
  });

  group.add(title);

  const subtitle = new Konva.Text({
    y: title.height() + 6,
    width,
    text: envelope.title,
    fontFamily: 'Inter',
    fontSize: textSm,
    lineHeight: 1.4,
    fill: textMutedForeground,
  });

  group.add(subtitle);

  return group;
};

type RenderContinuationHeaderOptions = {
  width: number;
  i18n: I18n;
};

/**
 * Compact running header for pages after the first.
 */
const renderContinuationHeader = (options: RenderContinuationHeaderOptions) => {
  const { width, i18n } = options;

  const group = new Konva.Group();

  const title = new Konva.Text({
    text: i18n._(msg`Audit Log`),
    fontFamily: 'Inter',
    fontSize: textSm,
    fontStyle: fontMedium,
    fill: textMutedForeground,
  });

  group.add(title);

  const rule = new Konva.Line({
    points: [0, 0, width, 0],
    stroke: hairlineColor,
    strokeWidth: 1,
    y: title.height() + 10,
  });

  group.add(rule);

  return group;
};

type RenderOverviewOptions = {
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeItems: string[];
  envelopeOwner: {
    email: string;
    name: string;
  };
  recipients: AuditLogRecipient[];
  width: number;
  i18n: I18n;
};

/**
 * Borderless two column description list of the envelope metadata.
 */
const renderOverview = (options: RenderOverviewOptions) => {
  const { envelope, envelopeItems, envelopeOwner, recipients, width, i18n } = options;

  const columnGap = 32;
  const columnWidth = (width - columnGap) / 2;
  const rowGap = 18;

  const group = new Konva.Group();

  const fieldPairs: [RenderFieldOptions, RenderFieldOptions][] = [
    [
      {
        label: i18n._(msg`Envelope ID`),
        text: envelope.id,
        width: columnWidth,
        wrapChar: true,
      },
      {
        label: i18n._(msg`Owner`),
        text: `${envelopeOwner.name} (${envelopeOwner.email})`,
        width: columnWidth,
      },
    ],
    [
      {
        label: i18n._(msg`Status`),
        text: i18n._(envelope.deletedAt ? msg`Deleted` : DOCUMENT_STATUS[envelope.status].description),
        width: columnWidth,
      },
      {
        label: i18n._(msg`Time Zone`),
        text: envelope.documentMeta?.timezone || 'N/A',
        width: columnWidth,
      },
    ],
    [
      {
        label: i18n._(msg`Created At`),
        text: DateTime.fromJSDate(envelope.createdAt)
          .setLocale(APP_I18N_OPTIONS.defaultLocale)
          .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
        width: columnWidth,
      },
      {
        label: i18n._(msg`Last Updated`),
        text: DateTime.fromJSDate(envelope.updatedAt)
          .setLocale(APP_I18N_OPTIONS.defaultLocale)
          .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
        width: columnWidth,
      },
    ],
    [
      {
        label: i18n._(msg`Enclosed Documents`),
        text: envelopeItems,
        width: columnWidth,
      },
      {
        label: i18n._(msg`Recipients`),
        text: recipients.map(
          (recipient) =>
            `${recipient.name} (${recipient.email}) · ${i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}`,
        ),
        width: columnWidth,
      },
    ],
  ];

  let y = 0;

  for (const [left, right] of fieldPairs) {
    const leftField = renderField(left);
    const rightField = renderField({ ...right, x: columnWidth + columnGap });

    leftField.y(y);
    rightField.y(y);

    group.add(leftField);
    group.add(rightField);

    y += Math.max(leftField.getClientRect().height, rightField.getClientRect().height) + rowGap;
  }

  return group;
};

type RenderRowOptions = {
  auditLog: TDocumentAuditLog;
  width: number;
  i18n: I18n;
};

/**
 * A single audit event: timestamp column beside the event description with a
 * muted actor line (email · IP address · device) underneath.
 */
const renderRow = (options: RenderRowOptions): RenderedRow => {
  const { auditLog, width, i18n } = options;

  const group = new Konva.Group();

  const eventX = timeColumnWidth + rowColumnGap;
  const eventWidth = width - eventX;

  const createdAt = DateTime.fromJSDate(auditLog.createdAt).setLocale(APP_I18N_OPTIONS.defaultLocale);

  const dateText = new Konva.Text({
    y: rowVerticalPadding,
    width: timeColumnWidth,
    text: createdAt.toFormat('yyyy-MM-dd'),
    fontFamily: 'Inter',
    fontSize: textXs + 0.5,
    fill: textForeground,
  });

  const timeText = new Konva.Text({
    y: dateText.y() + dateText.height() + 3,
    width: timeColumnWidth,
    text: createdAt.toFormat('hh:mm:ss a'),
    fontFamily: 'Inter',
    fontSize: textXs - 0.5,
    fill: textMutedForeground,
  });

  group.add(dateText);
  group.add(timeText);

  const descriptionText = new Konva.Text({
    x: eventX,
    y: rowVerticalPadding,
    width: eventWidth,
    text: formatDocumentAuditLogAction(i18n, auditLog).description,
    fontFamily: 'Inter',
    fontSize: textSm,
    lineHeight: 1.35,
    fill: textForeground,
  });

  group.add(descriptionText);

  let eventBottom = descriptionText.y() + descriptionText.height();

  parser.setUA(auditLog.userAgent || '');
  const userAgentInfo = parser.getResult();

  const metaSegments = [
    auditLog.email,
    auditLog.ipAddress,
    auditLog.userAgent ? i18n._(formatUserAgent(auditLog.userAgent, userAgentInfo)) : null,
  ].filter((segment): segment is string => Boolean(segment));

  if (metaSegments.length > 0) {
    const metaText = new Konva.Text({
      x: eventX,
      y: eventBottom + 4,
      width: eventWidth,
      text: metaSegments.join(' · '),
      fontFamily: 'Inter',
      fontSize: textXs,
      lineHeight: 1.35,
      fill: textMutedForeground,
    });

    group.add(metaText);

    eventBottom = metaText.y() + metaText.height();
  }

  const timeBottom = timeText.y() + timeText.height();
  const height = Math.max(eventBottom, timeBottom) + rowVerticalPadding;

  return { group, height };
};

const renderBranding = () => {
  const branding = new Konva.Group();

  const brandingHeight = 16;

  const logoPath = path.join(process.cwd(), 'public/static/logo.png');
  const logo = fs.readFileSync(logoPath);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const img = new SkiaImage(logo) as unknown as HTMLImageElement;

  const brandingImage = new Konva.Image({
    image: img,
    height: brandingHeight,
    width: brandingHeight * (img.width / img.height),
  });

  branding.add(brandingImage);
  return branding;
};

type GroupRowsIntoPagesOptions = {
  auditLogs: TDocumentAuditLog[];
  maxHeight: number;
  contentWidth: number;
  i18n: I18n;
  firstPageContentHeight: number;
  continuationHeaderHeight: number;
};

const groupRowsIntoPages = (options: GroupRowsIntoPagesOptions) => {
  const { auditLogs, maxHeight, contentWidth, i18n, firstPageContentHeight, continuationHeaderHeight } = options;

  const groupedRows: RenderedRow[][] = [[]];

  // First page has the document header and overview above the rows.
  let availableHeight = maxHeight - pageTopMargin - firstPageContentHeight;
  let currentGroupedRowIndex = 0;

  for (const auditLog of auditLogs) {
    const row = renderRow({ auditLog, width: contentWidth, i18n });

    if (row.height > availableHeight && groupedRows[currentGroupedRowIndex].length > 0) {
      currentGroupedRowIndex++;
      groupedRows[currentGroupedRowIndex] = [];

      // Subsequent pages only have the compact running header.
      availableHeight = maxHeight - pageTopMargin - continuationHeaderHeight;
    }

    groupedRows[currentGroupedRowIndex].push(row);

    availableHeight -= row.height;
  }

  return groupedRows;
};

export async function renderAuditLogs({
  envelope,
  envelopeOwner,
  envelopeItems,
  recipients,
  auditLogs,
  pageWidth,
  pageHeight,
  i18n,
  hidePoweredBy,
}: GenerateAuditLogsOptions) {
  ensureFontLibrary();

  const contentWidth = Math.min(pageWidth - pageMarginX * 2, contentMaxWidth);
  const margin = (pageWidth - contentWidth) / 2;

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });

  const documentHeader = renderDocumentHeader({ envelope, width: contentWidth, i18n });
  const overview = renderOverview({
    envelope,
    envelopeItems,
    envelopeOwner,
    recipients,
    width: contentWidth,
    i18n,
  });

  const documentHeaderHeight = documentHeader.getClientRect().height;
  const overviewHeight = overview.getClientRect().height;
  const firstPageContentHeight = documentHeaderHeight + headerGap + overviewHeight + sectionGap;

  const continuationHeader = renderContinuationHeader({ width: contentWidth, i18n });
  const continuationHeaderHeight = continuationHeader.getClientRect().height + headerGap;

  const groupedRows = groupRowsIntoPages({
    auditLogs,
    maxHeight: pageHeight - pageBottomMargin,
    contentWidth,
    i18n,
    firstPageContentHeight,
    continuationHeaderHeight,
  });

  // Assemble the content group for each page so heights are known before
  // footers and branding are placed.
  const pageGroups: Konva.Group[] = [];

  for (const [pageIndex, rows] of groupedRows.entries()) {
    const pageGroup = new Konva.Group({
      x: margin,
      y: pageTopMargin,
    });

    let yCursor = 0;

    if (pageIndex === 0) {
      pageGroup.add(documentHeader);
      yCursor += documentHeaderHeight + headerGap;

      overview.y(yCursor);
      pageGroup.add(overview);
      yCursor += overviewHeight + sectionGap;
    } else {
      const header = renderContinuationHeader({ width: contentWidth, i18n });
      pageGroup.add(header);
      yCursor += header.getClientRect().height + headerGap;
    }

    for (const [rowIndex, row] of rows.entries()) {
      if (rowIndex > 0) {
        const separator = new Konva.Line({
          points: [0, 0, contentWidth, 0],
          stroke: hairlineColor,
          strokeWidth: 0.75,
          y: yCursor,
        });

        pageGroup.add(separator);
      }

      row.group.y(yCursor);
      pageGroup.add(row.group);

      yCursor += row.height;
    }

    pageGroups.push(pageGroup);
  }

  const brandingGroup = !hidePoweredBy ? renderBranding() : null;
  const brandingTopPadding = 24;

  // Work out whether the branding fits below the content of the last page, or
  // whether it needs a page of its own, so the total page count is known
  // before rendering footers.
  let isBrandingPlacedOnLastPage = false;

  if (brandingGroup) {
    const lastPageGroup = pageGroups[pageGroups.length - 1];
    const lastPageContentBottom = lastPageGroup.y() + lastPageGroup.getClientRect().height;
    const brandingRect = brandingGroup.getClientRect();

    isBrandingPlacedOnLastPage =
      lastPageContentBottom + brandingTopPadding + brandingRect.height <= pageHeight - pageBottomMargin;
  }

  const totalPages = pageGroups.length + (brandingGroup && !isBrandingPlacedOnLastPage ? 1 : 0);

  const renderFooter = (page: Konva.Layer, pageNumber: number) => {
    const footerY = pageHeight - pageBottomMargin + 24;

    const envelopeIdText = new Konva.Text({
      x: margin,
      y: footerY,
      width: contentWidth,
      text: `${i18n._(msg`Envelope ID`)}: ${envelope.id}`,
      fontFamily: 'Inter',
      fontSize: textXs - 0.5,
      fill: textMutedForegroundLight,
    });

    const pageNumberText = new Konva.Text({
      x: margin,
      y: footerY,
      width: contentWidth,
      align: 'right',
      text: `${pageNumber} / ${totalPages}`,
      fontFamily: 'Inter',
      fontSize: textXs - 0.5,
      fill: textMutedForegroundLight,
    });

    page.add(envelopeIdText);
    page.add(pageNumberText);
  };

  const pages: Uint8Array[] = [];

  for (const [index, pageGroup] of pageGroups.entries()) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    page.add(pageGroup);
    renderFooter(page, index + 1);

    if (brandingGroup && isBrandingPlacedOnLastPage && index === pageGroups.length - 1) {
      const brandingRect = brandingGroup.getClientRect();

      // Anchor the branding to the bottom of the page rather than letting it
      // float directly under the content.
      brandingGroup.setAttrs({
        x: pageWidth - brandingRect.width - margin,
        y: pageHeight - pageBottomMargin - brandingRect.height,
      } satisfies Partial<Konva.GroupConfig>);

      page.add(brandingGroup);
    }

    stage.add(page);

    // Export the page and save it.
    const canvas = page.canvas._canvas as unknown as Canvas; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    const buffer = await canvas.toBuffer('pdf');
    pages.push(new Uint8Array(buffer));
  }

  // Branding gets a page of its own when it does not fit under the last page.
  if (brandingGroup && !isBrandingPlacedOnLastPage) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    const brandingRect = brandingGroup.getClientRect();

    brandingGroup.setAttrs({
      x: pageWidth - brandingRect.width - margin,
      y: pageHeight - pageBottomMargin - brandingRect.height,
    } satisfies Partial<Konva.GroupConfig>);

    page.add(brandingGroup);
    renderFooter(page, totalPages);

    stage.add(page);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const canvas = page.canvas._canvas as unknown as Canvas;
    const buffer = await canvas.toBuffer('pdf');

    pages.push(new Uint8Array(buffer));
  }

  stage.destroy();
  stage = null;

  return pages;
}

const formatUserAgent = (userAgent: string, userAgentInfo: UAParser.IResult) => {
  const browser = userAgentInfo.browser.name;
  const version = userAgentInfo.browser.version;
  const os = userAgentInfo.os.name;

  // If we can parse meaningful browser info, format it nicely
  if (browser && os) {
    const browserInfo = version ? `${browser} ${version}` : browser;

    return msg`${browserInfo} on ${os}`;
  }

  return msg`${userAgent}`;
};
