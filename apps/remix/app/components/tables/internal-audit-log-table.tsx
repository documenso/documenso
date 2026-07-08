import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
import type { TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import { UAParser } from 'ua-parser-js';

export type AuditLogDataTableProps = {
  logs: TDocumentAuditLog[];
};

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 */

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

export const InternalAuditLogTable = ({ logs }: AuditLogDataTableProps) => {
  const { _, i18n } = useLingui();

  const parser = new UAParser();

  return (
    <div className="divide-y divide-border">
      {logs.map((log, index) => {
        parser.setUA(log.userAgent || '');
        const formattedAction = formatDocumentAuditLogAction(i18n, log);
        const userAgentInfo = parser.getResult();

        const createdAt = DateTime.fromJSDate(log.createdAt).setLocale(APP_I18N_OPTIONS.defaultLocale);

        const metaSegments = [
          log.email,
          log.ipAddress,
          log.userAgent ? _(formatUserAgent(log.userAgent, userAgentInfo)) : null,
        ].filter((segment): segment is string => Boolean(segment));

        return (
          <div
            key={index}
            className="flex gap-5 py-2.5"
            style={{
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <div className="w-[5.5rem] shrink-0">
              <div className="text-foreground text-xs">{createdAt.toFormat('yyyy-MM-dd')}</div>

              <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">{createdAt.toFormat('hh:mm:ss a')}</div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-pretty text-foreground text-sm print:text-xs">{formattedAction.description}</div>

              {metaSegments.length > 0 && (
                <div className="mt-1 break-words text-muted-foreground text-xs print:text-[0.6875rem]">
                  {metaSegments.join(' · ')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
