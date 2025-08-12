import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
import {
  DOCUMENT_AUDIT_LOG_TYPE,
  type TDocumentAuditLog,
} from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export type AuditLogDataTableProps = {
  logs: TDocumentAuditLog[];
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

/**
 * Get the color indicator for the audit log type
 */

const getAuditLogIndicatorColor = (type: string) =>
  match(type)
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED, () => 'bg-green-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => 'bg-red-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT, () => 'bg-orange-500')
    .with(
      P.union(
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
      ),
      () => 'bg-blue-500',
    )
    .otherwise(() => 'bg-muted');

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 */

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

export const InternalAuditLogTable = ({ logs }: AuditLogDataTableProps) => {
  const { _ } = useLingui();

  const parser = new UAParser();

  return (
    <div className="space-y-4">
      {logs.map((log, index) => {
        parser.setUA(log.userAgent || '');
        const formattedAction = formatDocumentAuditLogAction(_, log);
        const userAgentInfo = parser.getResult();

        return (
          <Card
            key={index}
            // Add top margin for the first card to ensure it's not cut off from the 2nd page onwards
            className={`border shadow-sm ${index > 0 ? 'print:mt-8' : ''}`}
            style={{
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <CardContent className="p-4">
              {/* Header Section with indicator, event type, and timestamp */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-baseline gap-3">
                  <div
                    className={cn(`h-2 w-2 rounded-full`, getAuditLogIndicatorColor(log.type))}
                  />

                  <div>
                    <div className="text-muted-foreground text-sm font-medium uppercase tracking-wide print:text-[8pt]">
                      {log.type.replace(/_/g, ' ')}
                    </div>

                    <div className="text-foreground text-sm font-medium print:text-[8pt]">
                      {formattedAction.description}
                    </div>
                  </div>
                </div>

                <div className="text-muted-foreground text-sm print:text-[8pt]">
                  {DateTime.fromJSDate(log.createdAt)
                    .setLocale(APP_I18N_OPTIONS.defaultLocale)
                    .toLocaleString(dateFormat)}
                </div>
              </div>

              <hr className="my-4" />

              {/* Details Section - Two column layout */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs print:text-[6pt]">
                <div>
                  <div className="text-muted-foreground/70 font-medium uppercase tracking-wide">
                    {_(msg`User`)}
                  </div>

                  <div className="text-foreground mt-1 font-mono">{log.email || 'N/A'}</div>
                </div>

                <div className="text-right">
                  <div className="text-muted-foreground/70 font-medium uppercase tracking-wide">
                    {_(msg`IP Address`)}
                  </div>

                  <div className="text-foreground mt-1 font-mono">{log.ipAddress || 'N/A'}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-muted-foreground/70 font-medium uppercase tracking-wide">
                    {_(msg`User Agent`)}
                  </div>

                  <div className="text-foreground mt-1">
                    {_(formatUserAgent(log.userAgent, userAgentInfo))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
