import { type SentMessageInfo, type Transport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import { Resend } from 'resend';

const VERSION = '1.0.0';

type ResendTransportOptions = {
  apiKey: string;
};

type ResendResponseError = {
  statusCode: number;
  name: string;
  message: string;
};

const isResendResponseError = (error: unknown): error is ResendResponseError => {
  // We could use Zod here, but it's not worth the extra bundle size
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    'name' in error &&
    typeof error.name === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
};

/**
 * Transport for sending email via the Resend SDK.
 */
export class ResendTransport implements Transport<SentMessageInfo> {
  public name = 'ResendMailTransport';
  public version = VERSION;

  private _client: Resend;
  private _options: ResendTransportOptions;

  public static makeTransport(options: Partial<ResendTransportOptions>) {
    return new ResendTransport(options);
  }

  constructor(options: Partial<ResendTransportOptions>) {
    const { apiKey = '' } = options;

    this._options = {
      apiKey,
    };

    this._client = new Resend(apiKey);
  }

  public send(mail: MailMessage, callback: (_err: Error | null, _info: SentMessageInfo) => void) {
    if (!mail.data.to || !mail.data.from) {
      return callback(new Error('Missing required fields "to" or "from"'), null);
    }

    this._client
      .sendEmail({
        subject: mail.data.subject ?? '',
        from: this.toResendFromAddress(mail.data.from),
        to: this.toResendAddresses(mail.data.to),
        cc: this.toResendAddresses(mail.data.cc),
        bcc: this.toResendAddresses(mail.data.bcc),
        html: mail.data.html?.toString() || '',
        text: mail.data.text?.toString() || '',
        attachments: this.toResendAttachments(mail.data.attachments),
      })
      .then((response) => {
        if (isResendResponseError(response)) {
          throw new Error(`[${response.statusCode}]: ${response.name} ${response.message}`);
        }

        callback(null, response);
      })
      .catch((error) => {
        callback(error, null);
      });
  }

  private toResendAddresses(addresses: Mail.Options['to']) {
    if (!addresses) {
      return [];
    }

    if (typeof addresses === 'string') {
      return [addresses];
    }

    if (Array.isArray(addresses)) {
      return addresses.map((address) => {
        if (typeof address === 'string') {
          return address;
        }

        return address.address;
      });
    }

    return [addresses.address];
  }

  private toResendFromAddress(address: Mail.Options['from']) {
    if (!address) {
      return '';
    }

    if (typeof address === 'string') {
      return address;
    }

    return `${address.name} <${address.address}>`;
  }

  private toResendAttachments(attachments: Mail.Options['attachments']) {
    if (!attachments) {
      return [];
    }

    return attachments.map((attachment) => {
      if (!attachment.filename || !attachment.content) {
        throw new Error('Attachment is missing filename or content');
      }

      if (typeof attachment.content === 'string') {
        return {
          filename: attachment.filename,
          content: Buffer.from(attachment.content),
        };
      }

      if (attachment.content instanceof Buffer) {
        return {
          filename: attachment.filename,
          content: attachment.content,
        };
      }

      throw new Error('Attachment content must be a string or a buffer');
    });
  }
}
