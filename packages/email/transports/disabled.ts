import { SentMessageInfo, Transport } from 'nodemailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';

const VERSION = '1.0.0';

export class DisabledTransport implements Transport<SentMessageInfo> {
  public name = 'DisabledTransport';
  public version = VERSION;

  public static makeTransport() {
    return new DisabledTransport();
  }

  public send(_mail: MailMessage, callback: (_err: Error | null, _info: SentMessageInfo) => void) {
    return callback(null, null);
  }
}
