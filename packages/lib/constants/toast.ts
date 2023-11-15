import { Toast } from '@documenso/ui/primitives/use-toast';

export const TOAST_DOCUMENT_SHARE_SUCCESS: Toast = {
  title: 'Copied to clipboard',
  description: 'The sharing link has been copied to your clipboard.',
} as const;

export const TOAST_DOCUMENT_SHARE_ERROR: Toast = {
  variant: 'destructive',
  title: 'Something went wrong',
  description: 'The sharing link could not be created at this time. Please try again.',
  duration: 5000,
};
