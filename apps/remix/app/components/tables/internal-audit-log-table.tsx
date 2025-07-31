import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import type { DateTimeFormatOptions } from 'luxon';
import { UAParser } from 'ua-parser-js';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
import type { TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export type AuditLogDataTableProps = {
  logs: TDocumentAuditLog[];
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 */
export const InternalAuditLogTable = ({ logs }: AuditLogDataTableProps) => {
  const { _ } = useLingui();

  const parser = new UAParser();

  return (
    <div className="audit-log-container space-y-4">
      {logs.map((log, index) => {
        parser.setUA(log.userAgent || '');
        const browserInfo = parser.getResult();
        const formattedAction = formatDocumentAuditLogAction(_, log);

        return (
          <Card
            key={index}
            // Add top margin for the first card to ensure it's not cut off from the 2nd page onwards
            className={`audit-log-card border shadow-sm ${index > 0 ? 'print:mt-8' : ''}`}
            style={{
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <CardContent className="p-4">
              <div className="audit-log-grid grid grid-cols-12 gap-4">
                <div className="audit-log-section col-span-4 space-y-3">
                  <div>
                    <div className="text-background audit-log-label text-xs font-medium uppercase tracking-wide">
                      {_(msg`Event Type`)}
                    </div>
                    <div className="text-background audit-log-value mt-1 text-sm font-medium">
                      {log.type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-background audit-log-label text-xs font-medium uppercase tracking-wide">
                      {_(msg`Timestamp`)}
                    </div>
                    <div className="text-background audit-log-value mt-1 text-sm">
                      {DateTime.fromJSDate(log.createdAt)
                        .setLocale(APP_I18N_OPTIONS.defaultLocale)
                        .toLocaleString(dateFormat)}
                    </div>
                  </div>
                  <div>
                    <div className="text-background audit-log-label text-xs font-medium uppercase tracking-wide">
                      {_(msg`IP Address`)}
                    </div>
                    <div className="text-background audit-log-value mt-1 font-mono text-sm">
                      {log.ipAddress || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="audit-log-section col-span-4">
                  <div className="text-background audit-log-label mb-2 text-xs font-medium uppercase tracking-wide">
                    {_(msg`Action`)}
                  </div>
                  <div className="text-background audit-log-value break-words text-sm leading-relaxed">
                    {formattedAction.description}
                  </div>
                </div>

                <div className="audit-log-section col-span-4">
                  <div className="text-background audit-log-label mb-2 text-xs font-medium uppercase tracking-wide">
                    {_(msg`User`)}
                  </div>
                  {log.name || log.email ? (
                    <div className="space-y-1">
                      {log.name && (
                        <div
                          className="text-background audit-log-value break-words text-sm font-medium"
                          title={log.name}
                        >
                          {log.name}
                        </div>
                      )}
                      {log.email && (
                        <div
                          className="text-muted-foreground audit-log-value break-words text-sm"
                          title={log.email}
                        >
                          {log.email}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground audit-log-value text-sm">N/A</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
