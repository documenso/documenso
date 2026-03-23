import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta } from '@prisma/client';
import type { Envelope, RecipientRole } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import fs from 'node:fs';
import path from 'node:path';
import type { Canvas } from 'skia-canvas';
import { FontLibrary } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { match } from 'ts-pattern';
import { P } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';

import { DOCUMENT_STATUS } from '../../constants/document';
import { APP_I18N_OPTIONS } from '../../constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { TDocumentAuditLog } from '../../types/document-audit-logs';
import { formatDocumentAuditLogAction } from '../../utils/document-audit-logs';

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

const textMutedForegroundLight = '#929DAE';
const textForeground = '#000';
const textMutedForeground = '#64748B';
const textBase = 10;
const textSm = 9;
const textXs = 8;
const fontMedium = '500';

const pageTopMargin = 60;
const pageBottomMargin = 15;
const contentMaxWidth = 768;
const rowPadding = 10;
const titleFontSize = 18;

type RenderOverviewCardLabelAndTextOptions = {
  label: string;
  text: string | string[];
  width: number;
  groupX?: number;
};

const renderOverviewCardLabels = (options: RenderOverviewCardLabelAndTextOptions) => {
  const { width, text } = options;

  const labelYSpacing = 4;

  const group = new Konva.Group({
    x: options.groupX ?? 0,
  });

  const label = new Konva.Text({
    x: 0,
    y: 0,
    text: options.label,
    fontStyle: fontMedium,
    fontFamily: 'Inter',
    fill: textForeground,
    fontSize: textSm,
  });

  group.add(label);

  if (typeof text === 'string') {
    const value = new Konva.Text({
      x: 0,
      y: label.height() + labelYSpacing,
      width: width - label.width(),
      fontFamily: 'Inter',
      text,
      fill: textForeground,
      wrap: 'char',
      fontSize: textSm,
    });

    group.add(value);
  } else {
    for (const textValue of text) {
      const value = new Konva.Text({
        x: 0,
        y: group.getClientRect().height + 4,
        width: width - label.width(),
        fontFamily: 'Inter',
        text: '• ' + textValue,
        fill: textForeground,
        wrap: 'char',
        fontSize: textSm,
      });

      group.add(value);
    }
  }

  return group;
};

type RenderVerticalLabelAndTextOptions = {
  label: string;
  text: string;
  width?: number;
  align?: 'left' | 'right';
  x?: number;
  y?: number;
  textFontFamily?: string;
};

const renderVerticalLabelAndText = (options: RenderVerticalLabelAndTextOptions) => {
  const { label, text, width, align, x, y, textFontFamily } = options;

  const group = new Konva.Group({
    x: x ?? 0,
    y: y ?? 0,
  });

  const konvaLabel = new Konva.Text({
    align: align ?? 'left',
    fontFamily: 'Inter',
    width,
    text: label,
    fontSize: textXs,
    fill: textMutedForegroundLight,
  });

  group.add(konvaLabel);

  const konvaText = new Konva.Text({
    y: group.getClientRect().height + 6,
    align: align ?? 'left',
    fontFamily: textFontFamily ?? 'Inter',
    width,
    text: text,
    fontSize: textXs,
    fill: textForeground,
  });

  group.add(konvaText);

  return group;
};

type RenderOverviewCardOptions = {
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

const renderOverviewCard = (options: RenderOverviewCardOptions) => {
  const { envelope, envelopeItems, envelopeOwner, recipients, width, i18n } = options;
  const cardPadding = 16;

  const overviewCard = new Konva.Group();

  const columnSpacing = 10;
  const columnWidth = (width - columnSpacing) / 2;
  const rowVerticalSpacing = 32;

  const rowOne = new Konva.Group({
    x: cardPadding,
    y: cardPadding,
  });

  const envelopeIdLabel = renderOverviewCardLabels({
    label: i18n._(msg`Envelope ID`),
    text: envelope.id,
    width: columnWidth,
  });
  const ownerLabel = renderOverviewCardLabels({
    label: i18n._(msg`Owner`),
    text: `${envelopeOwner.name} (${envelopeOwner.email})`,
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowOne.add(envelopeIdLabel);
  rowOne.add(ownerLabel);
  overviewCard.add(rowOne);

  const rowTwo = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const statusLabel = renderOverviewCardLabels({
    label: i18n._(msg`Status`),
    text: i18n
      ._(envelope.deletedAt ? msg`Deleted` : DOCUMENT_STATUS[envelope.status].description)
      .toUpperCase(),
    width: columnWidth,
  });
  const timeZoneLabel = renderOverviewCardLabels({
    label: i18n._(msg`Time Zone`),
    text: envelope.documentMeta?.timezone || 'N/A',
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowTwo.add(statusLabel);
  rowTwo.add(timeZoneLabel);
  overviewCard.add(rowTwo);

  const rowThree = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const createdAtLabel = renderOverviewCardLabels({
    label: i18n._(msg`Created At`),
    text: DateTime.fromJSDate(envelope.createdAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
    width: columnWidth,
  });
  const lastUpdatedLabel = renderOverviewCardLabels({
    label: i18n._(msg`Last Updated`),
    text: DateTime.fromJSDate(envelope.updatedAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowThree.add(createdAtLabel);
  rowThree.add(lastUpdatedLabel);
  overviewCard.add(rowThree);

  const rowFour = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const enclosedDocumentsLabel = renderOverviewCardLabels({
    label: i18n._(msg`Enclosed Documents`),
    text: envelopeItems,
    width: columnWidth,
  });

  const recipientsLabel = renderOverviewCardLabels({
    label: i18n._(msg`Recipients`),
    text: recipients.map(
      (recipient) =>
        `[${i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}] ${recipient.name} (${recipient.email})`,
    ),
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowFour.add(enclosedDocumentsLabel);
  rowFour.add(recipientsLabel);
  overviewCard.add(rowFour);

  // Create rect border around the overview card
  const cardRect = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height: overviewCard.getClientRect().height + cardPadding * 2,
    stroke: '#e5e7eb',
    strokeWidth: 1.5,
    cornerRadius: 8,
  });

  overviewCard.add(cardRect);

  return overviewCard;
};

type RenderRowOptions = {
  auditLog: TDocumentAuditLog;
  width: number;
  i18n: I18n;
};

const renderRow = (options: RenderRowOptions) => {
  const { auditLog, width, i18n } = options;

  const paddingWithinCard = 12;

  const columnSpacing = 10;
  const columnWidth = (width - paddingWithinCard * 2 - columnSpacing) / 2;

  const indicatorWidth = 3;
  const indicatorPaddingRight = 10;
  const rowGroup = new Konva.Group();

  const rowHeaderGroup = new Konva.Group();

  const auditLogIndicatorColor = new Konva.Circle({
    x: indicatorWidth,
    y: indicatorWidth + 3,
    radius: indicatorWidth,
    fill: getAuditLogIndicatorColor(auditLog.type),
  });

  const auditLogTypeText = new Konva.Text({
    x: indicatorWidth + indicatorPaddingRight,
    y: 0,
    width: columnWidth - indicatorWidth - indicatorPaddingRight,
    text: auditLog.type.replace(/_/g, ' '),
    fontFamily: 'Inter',
    fontSize: textSm,
    fontStyle: fontMedium,
    fill: textMutedForeground,
  });

  const auditLogDescriptionText = new Konva.Text({
    x: indicatorWidth + indicatorPaddingRight,
    y: auditLogTypeText.height() + 4,
    width: columnWidth - indicatorWidth - indicatorPaddingRight,
    text: formatDocumentAuditLogAction(i18n, auditLog).description,
    fontFamily: 'Inter',
    fontSize: textSm,
    fill: textForeground,
  });

  const auditLogTimestampText = new Konva.Text({
    x: columnWidth + columnSpacing,
    width: columnWidth,
    text: DateTime.fromJSDate(auditLog.createdAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toLocaleString(dateFormat),
    fontFamily: 'Inter',
    align: 'right',
    fontSize: textSm,
    fill: textMutedForeground,
  });

  rowHeaderGroup.add(auditLogIndicatorColor);
  rowHeaderGroup.add(auditLogTypeText);
  rowHeaderGroup.add(auditLogDescriptionText);
  rowHeaderGroup.add(auditLogTimestampText);

  rowHeaderGroup.setAttrs({
    x: paddingWithinCard,
    y: paddingWithinCard,
  } satisfies Partial<Konva.GroupConfig>);

  rowGroup.add(rowHeaderGroup);

  // Draw border line.
  const borderLine = new Konva.Line({
    points: [0, 0, width - paddingWithinCard * 2, 0],
    stroke: '#e5e7eb',
    strokeWidth: 1,
    x: paddingWithinCard,
    y: rowGroup.getClientRect().height + paddingWithinCard + 12,
  });

  rowGroup.add(borderLine);

  const bottomSection = new Konva.Group({
    x: paddingWithinCard,
    y: rowGroup.getClientRect().height + paddingWithinCard + 12,
  });

  // Row 1 Column 1
  const userLabel = renderVerticalLabelAndText({
    label: i18n._(msg`User`).toUpperCase(),
    text: auditLog.email || 'N/A',
    align: 'left',
    width: columnWidth,
    textFontFamily: 'ui-monospace',
  });

  // Row 1 Column 2
  const ipAddressLabel = renderVerticalLabelAndText({
    label: i18n._(msg`IP Address`).toUpperCase(),
    text: auditLog.ipAddress || 'N/A',
    align: 'right',
    x: columnWidth + columnSpacing,
    width: columnWidth,
    textFontFamily: 'ui-monospace',
  });

  bottomSection.add(userLabel);
  bottomSection.add(ipAddressLabel);

  parser.setUA(auditLog.userAgent || '');
  const userAgentInfo = parser.getResult();

  // Row 2 Column 1
  const userAgentLabel = renderVerticalLabelAndText({
    label: i18n._(msg`User Agent`).toUpperCase(),
    text: i18n._(formatUserAgent(auditLog.userAgent, userAgentInfo)),
    align: 'left',
    width,
    y: bottomSection.getClientRect().height + 16,
  });

  bottomSection.add(userAgentLabel);
  rowGroup.add(bottomSection);

  const cardRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: rowGroup.getClientRect().width,
    height: rowGroup.getClientRect().height + paddingWithinCard * 2,
    stroke: '#e5e7eb',
    strokeWidth: 1,
    cornerRadius: 8,
  });

  rowGroup.add(cardRect);

  return rowGroup;
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
  overviewCard: Konva.Group;
};

const groupRowsIntoPages = (options: GroupRowsIntoPagesOptions) => {
  const { auditLogs, maxHeight, contentWidth, i18n, overviewCard } = options;

  const groupedRows: Konva.Group[][] = [[]];

  const overviewCardHeight = overviewCard.getClientRect().height;

  // First page has title + overview card
  let availableHeight = maxHeight - pageTopMargin - overviewCardHeight;
  let currentGroupedRowIndex = 0;

  // Group rows into pages.
  for (const auditLog of auditLogs) {
    const row = renderRow({ auditLog, width: contentWidth, i18n });

    const rowHeight = row.getClientRect().height;
    const requiredHeight = rowHeight + rowPadding;

    if (requiredHeight > availableHeight) {
      currentGroupedRowIndex++;
      groupedRows[currentGroupedRowIndex] = [row];

      // Subsequent pages only have title (no overview card)
      availableHeight = maxHeight - pageTopMargin;
    } else {
      groupedRows[currentGroupedRowIndex].push(row);
    }

    // Reduce available height by the row height.
    availableHeight -= requiredHeight;
  }

  return groupedRows;
};

type RenderPagesOptions = {
  groupedRows: Konva.Group[][];
  margin: number;
  pageTopMargin: number;
  i18n: I18n;
  overviewCard: Konva.Group;
};

const renderPages = (options: RenderPagesOptions) => {
  const { groupedRows, margin, pageTopMargin, i18n, overviewCard } = options;

  const rowPadding = 10;
  const pages: Konva.Group[] = [];

  // Render the rows for each page.
  for (const [pageIndex, rows] of groupedRows.entries()) {
    const pageGroup = new Konva.Group();

    // Add title to each page
    const pageTitle = new Konva.Text({
      x: margin,
      y: 0,
      height: pageTopMargin,
      verticalAlign: 'middle',
      text: i18n._(msg`Audit Log`),
      fill: textForeground,
      fontFamily: 'Inter',
      fontSize: titleFontSize,
      fontStyle: '700',
    });
    pageGroup.add(pageTitle);

    // Add overview card only on first page
    if (pageIndex === 0) {
      overviewCard.setAttrs({
        x: margin,
        y: pageGroup.getClientRect().height,
      });
      pageGroup.add(overviewCard);
    }

    // Add rows to the page
    for (const row of rows) {
      const yPosition = pageGroup.getClientRect().height + rowPadding;

      row.setAttrs({
        x: margin,
        y: yPosition,
      });

      pageGroup.add(row);
    }

    pages.push(pageGroup);
  }

  return pages;
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
  const fontPath = path.join(process.cwd(), 'public/fonts');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  FontLibrary.use({
    ['Caveat']: [path.join(fontPath, 'caveat.ttf')],
    ['Inter']: [path.join(fontPath, 'inter-variablefont_opsz,wght.ttf')],
  });

  const minimumMargin = 10;

  const contentWidth = Math.min(pageWidth - minimumMargin * 2, contentMaxWidth);
  const margin = (pageWidth - contentWidth) / 2;

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });

  const overviewCard = renderOverviewCard({
    envelope,
    envelopeOwner,
    envelopeItems,
    recipients,
    width: contentWidth,
    i18n,
  });

  const groupedRows = groupRowsIntoPages({
    auditLogs,
    maxHeight: pageHeight,
    contentWidth,
    i18n,
    overviewCard,
  });

  const pageGroups = renderPages({
    groupedRows,
    margin,
    pageTopMargin,
    i18n,
    overviewCard,
  });

  const brandingGroup = renderBranding();
  const brandingRect = brandingGroup.getClientRect();
  const brandingTopPadding = 24;

  const pages: Uint8Array[] = [];

  let isBrandingPlaced = false;

  // Render each page group to PDF
  for (const [index, pageGroup] of pageGroups.entries()) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    page.add(pageGroup);

    // Add branding on the last page if there is space.
    if (index === pageGroups.length - 1 && !hidePoweredBy) {
      const remainingHeight = pageHeight - pageGroup.getClientRect().height - pageBottomMargin;

      if (brandingRect.height + brandingTopPadding <= remainingHeight) {
        brandingGroup.setAttrs({
          x: pageWidth - brandingRect.width - margin,
          y: pageGroup.getClientRect().height + brandingTopPadding,
        } satisfies Partial<Konva.GroupConfig>);

        page.add(brandingGroup);
        isBrandingPlaced = true;
      }
    }

    stage.add(page);

    // Export the page and save it.
    const canvas = page.canvas._canvas as unknown as Canvas; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    const buffer = await canvas.toBuffer('pdf');
    pages.push(new Uint8Array(buffer));
  }

  // Need to create an empty page for the branding if it hasn't been placed yet.
  if (!hidePoweredBy && !isBrandingPlaced) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    brandingGroup.setAttrs({
      x: pageWidth - brandingRect.width - margin,
      y: pageTopMargin,
    } satisfies Partial<Konva.GroupConfig>);

    page.add(brandingGroup);
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

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

/**
 * Get the color indicator for the audit log type
 */
const getAuditLogIndicatorColor = (type: string) =>
  match(type)
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED, () => '#22c55e') // bg-green-500
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => '#ef4444') // bg-red-500
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT, () => '#f97316') // bg-orange-500
    .with(
      P.union(
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
      ),
      () => '#3b82f6', // bg-blue-500
    )
    .otherwise(() => '#f1f5f9'); // bg-muted

const formatUserAgent = (userAgent: string | null | undefined, userAgentInfo: UAParser.IResult) => {
  if (!userAgent) {
    return msg`N/A`;
  }

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
