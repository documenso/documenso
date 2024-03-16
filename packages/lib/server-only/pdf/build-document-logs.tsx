import { Document, Page, StyleSheet, Text, View, renderToStream } from '@react-pdf/renderer';
import { UAParser } from 'ua-parser-js';

import type { DocumentFromDocumentById } from '@documenso/prisma/types/document';
import { signPdf } from '@documenso/signing';

import type { TDocumentAuditLog } from '../../types/document-audit-logs';
import { putFile } from '../../universal/upload/put-file';
import { formatDocumentAuditLogAction } from '../../utils/document-audit-logs';

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
  },
  title: {
    marginBottom: 15,
    fontSize: 16,
  },
  subTitle: {
    marginBottom: 10,
    fontSize: 14,
  },
  details: {
    borderColor: '#a2e771',
    paddingTop: 8,
    paddingRight: 5,
    paddingBottom: 5,
    paddingLeft: 5,
    borderWidth: 1,
    marginBottom: 15,
  },
  detailsRow: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  detailsCell: {
    flex: 1,
  },
  detailsCellText: {
    fontSize: 10,
    color: '#64748B',
  },
  headerText: {
    fontSize: 10,
    fontWeight: 500,
  },
  logsHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    padding: 5,
    borderColor: '#cccccc',
    borderWidth: 1,
    fontSize: 10,
  },
  logsRow: {
    width: '100%',
    flexDirection: 'row',
    padding: 5,
    borderColor: '#cccccc',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    fontSize: 10,
  },
  logsCol1: {
    width: '15%',
  },
  logsCol2: {
    width: '27%',
  },
  logsCol3: {
    width: '28%',
  },
  logsCol4: {
    width: '15%',
  },
  logsCol5: {
    width: '15%',
  },
});

export type BuildDocumentLogsOptions = {
  document: DocumentFromDocumentById;
  recipientsList: string[];
  auditLogs: TDocumentAuditLog[];
};

export const buildDocumentLogs = async ({
  document,
  recipientsList,
  auditLogs,
}: BuildDocumentLogsOptions) => {
  const parser = new UAParser();
  const logs = auditLogs.map((auditLog) => {
    return {
      id: auditLog.id,
      datetime: {
        date: auditLog.createdAt.toLocaleDateString(),
        time: auditLog.createdAt.toLocaleTimeString(),
      },
      user:
        auditLog.name || auditLog.email ? { name: auditLog.name, email: auditLog.email } : 'N/A',
      action: formatDocumentAuditLogAction(auditLog).description,
      ipAddress: auditLog.ipAddress,
      browser: auditLog.userAgent
        ? parser.setUA(auditLog.userAgent).getResult().browser.name ?? 'N/A'
        : 'N/A',
    };
  });
  const documentLogs = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.title}>
          <Text>{document.title} - Audit Logs</Text>
        </View>
        <View style={styles.subTitle}>
          <Text>Details</Text>
        </View>
        <View style={styles.details}>
          <View style={styles.detailsRow}>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Document title</Text>
              <Text style={styles.detailsCellText}>{document.title}</Text>
            </View>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Document ID</Text>
              <Text style={styles.detailsCellText}>{document.id.toString()}</Text>
            </View>
          </View>
          <View style={styles.detailsRow}>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Document status</Text>
              <Text style={styles.detailsCellText}>{document.status}</Text>
            </View>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Created by</Text>
              <Text style={styles.detailsCellText}>
                {document.User.name ?? document.User.email}
              </Text>
            </View>
          </View>
          <View style={styles.detailsRow}>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Date created</Text>
              <Text style={styles.detailsCellText}>{document.createdAt.toISOString()}</Text>
            </View>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Last updated</Text>
              <Text style={styles.detailsCellText}>{document.updatedAt.toISOString()}</Text>
            </View>
          </View>
          <View style={styles.detailsRow}>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Time zone</Text>
              <Text style={styles.detailsCellText}>{document.documentMeta?.timezone ?? 'N/A'}</Text>
            </View>
            <View style={styles.detailsCell}>
              <Text style={styles.headerText}>Recipients</Text>
              <View>
                {recipientsList.map((recipient) => (
                  <Text style={styles.detailsCellText} key={recipient}>
                    • {recipient}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.logsHeaderRow}>
          <View style={styles.logsCol1}>
            <Text>Date</Text>
          </View>
          <View style={styles.logsCol2}>
            <Text>User</Text>
          </View>
          <View style={styles.logsCol3}>
            <Text>Action</Text>
          </View>
          <View style={styles.logsCol4}>
            <Text>IP Address</Text>
          </View>
          <View style={styles.logsCol5}>
            <Text>Browser</Text>
          </View>
        </View>
        {logs.map((log) => (
          <View key={log.id} style={styles.logsRow}>
            <View style={styles.logsCol1}>
              <Text>{log.datetime.date}</Text>
              <Text>{log.datetime.time}</Text>
            </View>
            <View style={styles.logsCol2}>
              {typeof log.user === 'string' ? (
                <Text>{log.user}</Text>
              ) : (
                <>
                  <Text>{log.user.name}</Text>
                  <Text>{log.user.email}</Text>
                </>
              )}
            </View>
            <View style={styles.logsCol3}>
              <Text>{log.action}</Text>
            </View>
            <View style={styles.logsCol4}>
              <Text>{log.ipAddress}</Text>
            </View>
            <View style={styles.logsCol5}>
              <Text>{log.browser}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );

  const pdfBuffer: Buffer = await renderToStream(documentLogs).then(
    async (stream) =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (error) => reject(error));
      }),
  );
  const signedBuffer = await signPdf({ pdf: pdfBuffer });

  return putFile(
    {
      name: `${document.title}_logs.pdf`,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(signedBuffer),
    },
    { skipDocumentDataCreate: true },
  );
};
