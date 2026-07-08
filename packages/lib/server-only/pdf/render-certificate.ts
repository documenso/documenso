import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { Field, RecipientRole, Signature } from '@prisma/client';
import { SigningStatus } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { UAParser } from 'ua-parser-js';
import { renderSVG } from 'uqr';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { APP_I18N_OPTIONS } from '../../constants/i18n';
import { getSignatureFontFamily } from '../../constants/pdf';
import { RECIPIENT_ROLE_SIGNING_REASONS, RECIPIENT_ROLES_DESCRIPTION } from '../../constants/recipient-roles';
import type { TDocumentAuditLogBaseSchema } from '../../types/document-audit-logs';
import { svgToPng } from '../../utils/images/svg-to-png';
import { ensureFontLibrary } from './helpers';

type ColumnWidths = [number, number, number];

type BaseAuditLog = Pick<TDocumentAuditLogBaseSchema, 'createdAt' | 'ipAddress' | 'userAgent'>;

export type CertificateRecipient = {
  id: number;
  name: string;
  email: string;
  role: RecipientRole;
  rejectionReason: string | null;
  signingStatus: SigningStatus;
  signatureField?: Pick<Field, 'id' | 'secondaryId' | 'recipientId'> & {
    signature?: Pick<Signature, 'signatureImageAsBase64' | 'typedSignature'> | null;
  };
  authLevel: string;
  logs: {
    emailed: BaseAuditLog | null;
    sent: BaseAuditLog | null;
    opened: BaseAuditLog | null;
    completed: BaseAuditLog | null;
    rejected: BaseAuditLog | null;
  };
};

type GenerateCertificateOptions = {
  recipients: CertificateRecipient[];
  envelopeId: string;
  envelopeTitle: string;
  qrToken: string | null;
  hidePoweredBy: boolean;
  i18n: I18n;
  envelopeOwner: {
    name: string;
    email: string;
  };
  pageWidth: number;
  pageHeight: number;
};

// Helper function to get device info from user agent
const getDevice = (userAgent?: string | null): string => {
  if (!userAgent) {
    return 'Unknown';
  }

  const parser = new UAParser(userAgent);

  parser.setUA(userAgent);

  const result = parser.getResult();

  return `${result.os.name} - ${result.browser.name} ${result.browser.version}`;
};

const textForeground = '#000';
const textMutedForeground = '#64748B';
const textMutedForegroundLight = '#929DAE';
const textRejectedRed = '#DC2626';
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

const columnWidthPercentages = [30, 30, 40];
const columnGap = 16;
const rowVerticalPadding = 12;
const fieldGap = 10;

/**
 * Formats a timestamp consistently across the certificate.
 */
const formatTimestamp = (date: Date) =>
  DateTime.fromJSDate(date).setLocale(APP_I18N_OPTIONS.defaultLocale).toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)');

type RenderedRow = {
  group: Konva.Group;
  height: number;
};

type RenderFieldOptions = {
  label: string;
  text: string;
  width: number;
  y?: number;
  labelFill?: string;
  valueFill?: string;
  valueFontFamily?: string;
  wrapChar?: boolean;
};

/**
 * A single description-list field: a small muted label above its value.
 */
const renderField = (options: RenderFieldOptions) => {
  const { label, text, width, y, labelFill, valueFill, valueFontFamily, wrapChar } = options;

  const group = new Konva.Group({
    y: y ?? 0,
  });

  const labelText = new Konva.Text({
    text: label,
    fontFamily: 'Inter',
    fontSize: textXs,
    fontStyle: fontMedium,
    fill: labelFill ?? textMutedForeground,
  });

  group.add(labelText);

  const valueText = new Konva.Text({
    y: labelText.height() + 4,
    width,
    text,
    fontFamily: valueFontFamily ?? 'Inter',
    fontSize: textXs + 0.5,
    lineHeight: 1.35,
    fill: valueFill ?? textForeground,
    wrap: wrapChar ? 'char' : 'word',
  });

  group.add(valueText);

  return group;
};

type RenderDocumentHeaderOptions = {
  envelopeTitle: string;
  width: number;
  i18n: I18n;
};

/**
 * First page header: title with the document title underneath.
 */
const renderDocumentHeader = (options: RenderDocumentHeaderOptions) => {
  const { envelopeTitle, width, i18n } = options;

  const group = new Konva.Group();

  const title = new Konva.Text({
    text: i18n._(msg`Signing Certificate`),
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
    text: envelopeTitle,
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
    text: i18n._(msg`Signing Certificate`),
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

type RenderTableHeaderOptions = {
  columnWidths: ColumnWidths;
  i18n: I18n;
};

/**
 * Column labels for the recipients table with a hairline rule underneath.
 */
const renderTableHeader = (options: RenderTableHeaderOptions) => {
  const { columnWidths, i18n } = options;

  const group = new Konva.Group();

  const labels = [i18n._(msg`Signer Events`), i18n._(msg`Signature`), i18n._(msg`Details`)];

  let x = 0;

  for (const [index, label] of labels.entries()) {
    const labelText = new Konva.Text({
      x,
      width: columnWidths[index] - columnGap,
      text: label,
      fontFamily: 'Inter',
      fontSize: textXs,
      fontStyle: fontMedium,
      fill: textMutedForeground,
    });

    group.add(labelText);

    x += columnWidths[index];
  }

  const rule = new Konva.Line({
    points: [0, 0, columnWidths[0] + columnWidths[1] + columnWidths[2], 0],
    stroke: hairlineColor,
    strokeWidth: 1,
    y: group.getClientRect().height + 8,
  });

  group.add(rule);

  return group;
};

type RenderColumnOptions = {
  recipient: CertificateRecipient;
  width: number;
  i18n: I18n;
  envelopeOwner: {
    name: string;
    email: string;
  };
};

const renderColumnOne = (options: RenderColumnOptions) => {
  const { recipient, width, i18n } = options;

  const column = new Konva.Group();

  if (recipient.name) {
    const nameText = new Konva.Text({
      width,
      text: recipient.name,
      fontFamily: 'Inter',
      fontSize: textSm,
      fontStyle: fontMedium,
      lineHeight: 1.35,
      fill: textForeground,
    });

    column.add(nameText);
  }

  const emailText = new Konva.Text({
    y: column.getClientRect().height + (recipient.name ? 2 : 0),
    width,
    text: recipient.email,
    fontFamily: 'Inter',
    fontSize: textXs,
    lineHeight: 1.35,
    fill: textMutedForeground,
    wrap: 'char',
  });

  column.add(emailText);

  const roleText = new Konva.Text({
    y: emailText.y() + emailText.height() + 3,
    width,
    text: i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName),
    fontFamily: 'Inter',
    fontSize: textXs,
    lineHeight: 1.35,
    fill: textMutedForeground,
  });

  column.add(roleText);

  const authField = renderField({
    label: i18n._(msg`Authentication Level`),
    text: recipient.authLevel,
    width,
    y: roleText.y() + roleText.height() + fieldGap,
  });

  column.add(authField);

  return column;
};

const renderColumnTwo = (options: RenderColumnOptions) => {
  const { recipient, width, i18n } = options;

  const column = new Konva.Group();

  const isRejected = Boolean(recipient.logs.rejected);

  if (recipient.signatureField?.secondaryId) {
    // Signature container with green border
    const signatureContainer = new Konva.Group({ x: 0, y: 0 });

    const minSignatureHeight = 40;
    const maxSignatureWidth = 100;

    // Signature content
    if (recipient.signatureField?.signature?.signatureImageAsBase64) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const img = new SkiaImage(
        recipient.signatureField?.signature?.signatureImageAsBase64,
      ) as unknown as HTMLImageElement;

      const signatureImage = new Konva.Image({
        image: img,
        x: 4,
        y: 4,
        width: maxSignatureWidth,
        height: maxSignatureWidth * (img.height / img.width),
      });

      signatureContainer.add(signatureImage);
    } else if (recipient.signatureField?.signature?.typedSignature) {
      const typedSig = new Konva.Text({
        x: 2,
        text: recipient.signatureField?.signature?.typedSignature,
        padding: 4,
        fontFamily: getSignatureFontFamily(recipient.signatureField?.signature?.typedSignature),
        fontSize: 16,
        align: 'center',
        verticalAlign: 'middle',
        width: maxSignatureWidth,
      });

      if (typedSig.getClientRect().height < minSignatureHeight) {
        typedSig.setAttrs({
          height: minSignatureHeight,
        });
      }

      signatureContainer.add(typedSig);
    }

    // Do not add the signature container for rejected recipients.
    if (!isRejected) {
      column.add(signatureContainer);
    }

    const signatureHeight = Math.max(signatureContainer.getClientRect().height, minSignatureHeight);

    const signatureBorder = new Konva.Rect({
      x: 2,
      y: 2,
      width: maxSignatureWidth,
      height: signatureHeight,
      stroke: 'rgba(122, 196, 85, 0.6)',
      strokeWidth: 1,
      cornerRadius: 8,
    });
    signatureContainer.add(signatureBorder);

    const signatureShadow = new Konva.Rect({
      x: 0,
      y: 0,
      width: maxSignatureWidth + 4,
      height: signatureHeight + 4,
      stroke: 'rgba(122, 196, 85, 0.1)',
      strokeWidth: 4,
      cornerRadius: 8,
    });
    signatureContainer.add(signatureShadow);

    const signatureIdField = renderField({
      label: i18n._(msg`Signature ID`),
      text: recipient.signatureField.secondaryId.toUpperCase(),
      width,
      y: isRejected ? 0 : signatureHeight + fieldGap,
      valueFontFamily: 'monospace',
      wrapChar: true,
    });

    column.add(signatureIdField);
  } else {
    const naText = new Konva.Text({
      text: i18n._(msg`N/A`),
      fill: textMutedForeground,
      fontFamily: 'Inter',
      fontSize: textXs + 0.5,
    });

    column.add(naText);
  }

  const relevantLog = isRejected ? recipient.logs.rejected : recipient.logs.completed;

  const ipField = renderField({
    label: i18n._(msg`IP Address`),
    text: relevantLog?.ipAddress ?? i18n._(msg`Unknown`),
    width,
    y: column.getClientRect().height + fieldGap,
  });

  column.add(ipField);

  const deviceField = renderField({
    label: i18n._(msg`Device`),
    text: getDevice(relevantLog?.userAgent),
    width,
    y: column.getClientRect().height + fieldGap,
  });

  column.add(deviceField);

  return column;
};

const renderColumnThree = (options: RenderColumnOptions) => {
  const { recipient, width, i18n, envelopeOwner } = options;

  const column = new Konva.Group();

  type DetailItem = {
    label: string;
    value: string;
    labelFill?: string;
    valueFill?: string;
  };

  const itemsToRender: DetailItem[] = [
    {
      label: i18n._(msg`Sent`),
      value: recipient.logs.emailed
        ? formatTimestamp(recipient.logs.emailed.createdAt)
        : recipient.logs.sent
          ? formatTimestamp(recipient.logs.sent.createdAt)
          : i18n._(msg`Unknown`),
    },
    {
      label: i18n._(msg`Viewed`),
      value: recipient.logs.opened ? formatTimestamp(recipient.logs.opened.createdAt) : i18n._(msg`Unknown`),
    },
  ];

  if (recipient.logs.rejected) {
    itemsToRender.push({
      label: i18n._(msg`Rejected`),
      value: formatTimestamp(recipient.logs.rejected.createdAt),
      labelFill: textRejectedRed,
      valueFill: textRejectedRed,
    });
  } else {
    itemsToRender.push({
      label: i18n._(msg`Signed`),
      value: recipient.logs.completed ? formatTimestamp(recipient.logs.completed.createdAt) : i18n._(msg`Unknown`),
    });
  }

  const isOwner = recipient.email.toLowerCase() === envelopeOwner.email.toLowerCase();

  itemsToRender.push({
    label: i18n._(msg`Reason`),
    value:
      recipient.signingStatus === SigningStatus.REJECTED
        ? recipient.rejectionReason || ''
        : isOwner
          ? i18n._(msg`I am the owner of this document`)
          : i18n._(RECIPIENT_ROLE_SIGNING_REASONS[recipient.role]),
  });

  for (const [index, item] of itemsToRender.entries()) {
    const field = renderField({
      label: item.label,
      text: item.value,
      width,
      y: column.getClientRect().height + (index === 0 ? 0 : fieldGap),
      labelFill: item.labelFill,
      valueFill: item.valueFill,
    });

    column.add(field);
  }

  return column;
};

type RenderRowOptions = {
  recipient: CertificateRecipient;
  columnWidths: ColumnWidths;
  i18n: I18n;
  envelopeOwner: {
    name: string;
    email: string;
  };
};

const renderRow = (options: RenderRowOptions): RenderedRow => {
  const { recipient, columnWidths, i18n, envelopeOwner } = options;

  const group = new Konva.Group();

  const columns = [renderColumnOne, renderColumnTwo, renderColumnThree];

  let x = 0;
  let maxColumnBottom = 0;

  for (const [index, renderColumn] of columns.entries()) {
    const column = renderColumn({
      recipient,
      width: columnWidths[index] - columnGap,
      i18n,
      envelopeOwner,
    });

    column.setAttrs({
      x,
      y: rowVerticalPadding,
    } satisfies Partial<Konva.GroupConfig>);

    group.add(column);

    maxColumnBottom = Math.max(maxColumnBottom, rowVerticalPadding + column.getClientRect().height);

    x += columnWidths[index];
  }

  return { group, height: maxColumnBottom + rowVerticalPadding };
};

const renderBranding = async ({ qrToken, i18n }: { qrToken: string | null; i18n: I18n }) => {
  const branding = new Konva.Group();

  const brandingHeight = 12;

  const text = new Konva.Text({
    x: 0,
    verticalAlign: 'middle',
    text: `${i18n._(msg`Signing certificate provided by`)}:`,
    fontStyle: fontMedium,
    fontFamily: 'Inter',
    fontSize: textXs,
    fill: textMutedForeground,
    height: brandingHeight,
  });

  const logoPath = path.join(process.cwd(), 'public/static/logo.png');
  const logo = fs.readFileSync(logoPath);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const img = new SkiaImage(logo) as unknown as HTMLImageElement;

  const documensoImage = new Konva.Image({
    image: img,
    height: brandingHeight,
    width: brandingHeight * (img.width / img.height),
    x: text.width() + 16,
  });

  const qrSize = qrToken ? 72 : 0;

  const logoGroup = new Konva.Group({
    y: qrSize ? qrSize + 16 : 0,
  });
  logoGroup.add(text);
  logoGroup.add(documensoImage);

  branding.add(logoGroup);

  if (qrToken) {
    const qrSvg = renderSVG(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${qrToken}`, {
      ecc: 'Q',
    });

    const svgImage = await svgToPng(qrSvg);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const qrSkiaImage = new SkiaImage(svgImage) as unknown as HTMLImageElement;
    const qrImage = new Konva.Image({
      image: qrSkiaImage,
      height: qrSize,
      width: qrSize,
      x: branding.getClientRect().width - qrSize,
      y: 0,
    });

    branding.add(qrImage);
  }

  return branding;
};

type GroupRowsIntoPagesOptions = {
  recipients: CertificateRecipient[];
  maxHeight: number;
  i18n: I18n;
  columnWidths: ColumnWidths;
  envelopeOwner: {
    name: string;
    email: string;
  };
  firstPageContentHeight: number;
  continuationHeaderHeight: number;
  tableHeaderHeight: number;
};

const groupRowsIntoPages = (options: GroupRowsIntoPagesOptions) => {
  const {
    recipients,
    maxHeight,
    i18n,
    columnWidths,
    envelopeOwner,
    firstPageContentHeight,
    continuationHeaderHeight,
    tableHeaderHeight,
  } = options;

  const groupedRows: RenderedRow[][] = [[]];

  // First page has the document header, then every page has the table header.
  let availableHeight = maxHeight - pageTopMargin - firstPageContentHeight - tableHeaderHeight;
  let currentGroupedRowIndex = 0;

  for (const recipient of recipients) {
    const row = renderRow({ recipient, columnWidths, i18n, envelopeOwner });

    if (row.height > availableHeight && groupedRows[currentGroupedRowIndex].length > 0) {
      currentGroupedRowIndex++;
      groupedRows[currentGroupedRowIndex] = [];

      availableHeight = maxHeight - pageTopMargin - continuationHeaderHeight - tableHeaderHeight;
    }

    groupedRows[currentGroupedRowIndex].push(row);

    availableHeight -= row.height;
  }

  return groupedRows;
};

export async function renderCertificate({
  recipients,
  envelopeId,
  envelopeTitle,
  qrToken,
  hidePoweredBy,
  i18n,
  envelopeOwner,
  pageWidth,
  pageHeight,
}: GenerateCertificateOptions) {
  ensureFontLibrary();

  const contentWidth = Math.min(pageWidth - pageMarginX * 2, contentMaxWidth);
  const margin = (pageWidth - contentWidth) / 2;

  const columnWidths: ColumnWidths = [
    (contentWidth * columnWidthPercentages[0]) / 100,
    (contentWidth * columnWidthPercentages[1]) / 100,
    (contentWidth * columnWidthPercentages[2]) / 100,
  ];

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });

  const documentHeader = renderDocumentHeader({ envelopeTitle, width: contentWidth, i18n });
  const documentHeaderHeight = documentHeader.getClientRect().height;
  const firstPageContentHeight = documentHeaderHeight + headerGap;

  const continuationHeader = renderContinuationHeader({ width: contentWidth, i18n });
  const continuationHeaderHeight = continuationHeader.getClientRect().height + headerGap;

  const tableHeaderHeight = renderTableHeader({ columnWidths, i18n }).getClientRect().height;

  const groupedRows = groupRowsIntoPages({
    recipients,
    maxHeight: pageHeight - pageBottomMargin,
    columnWidths,
    i18n,
    envelopeOwner,
    firstPageContentHeight,
    continuationHeaderHeight,
    tableHeaderHeight,
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
    } else {
      const header = renderContinuationHeader({ width: contentWidth, i18n });
      pageGroup.add(header);
      yCursor += header.getClientRect().height + headerGap;
    }

    const tableHeader = renderTableHeader({ columnWidths, i18n });
    tableHeader.y(yCursor);
    pageGroup.add(tableHeader);
    yCursor += tableHeaderHeight;

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

  const brandingGroup = !hidePoweredBy ? await renderBranding({ qrToken, i18n }) : null;
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
      text: `${i18n._(msg`Envelope ID`)}: ${envelopeId}`,
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
