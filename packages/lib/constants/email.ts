import { env } from '../utils/env';

export const FROM_ADDRESS = env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com';
export const FROM_NAME = env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso';

export const SERVICE_USER_EMAIL = 'serviceaccount@documenso.com';
