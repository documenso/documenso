import twilio from 'twilio';

import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} from '../../../constants/notifications';

export interface sendMessageOptions {
  phone: string;
  message: string;
}

export const sendWhatsAppMessage = async ({ phone, message }: sendMessageOptions) => {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  await client.messages
    .create({
      body: message,
      from: `whatsapp:+`+TWILIO_PHONE_NUMBER,
      to: `whatsapp:+`+phone,
    })
    .then((message: any) => console.warn(message))
    .catch((error) => {
      console.error(error);
    });
};
