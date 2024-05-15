import type { Toast } from '@documenso/ui/primitives/use-toast';

export const TOAST_DOCUMENT_SHARE_SUCCESS: Toast = {
  title: 'დაკოპირდა',
  description: 'გაზიარების ბმული წარმატებით დაკოპირდა.',
} as const;

export const TOAST_DOCUMENT_SHARE_ERROR: Toast = {
  variant: 'destructive',
  title: 'დაფიქსირდა ხარვეზი',
  description: 'გაზიარების ბმული ამჯერად ვერ შეიქმნა. გთხოვთ თავიდან სცადეთ.',
  duration: 5000,
};
