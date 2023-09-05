import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Dialog, DialogOverlay, DialogPortal } from './dialog';
import { LazyPDFViewerNoLoader } from './lazy-pdf-viewer';

export type DocumentDialogProps = {
  document: string;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

/**
 * A dialog which renders the provided document.
 */
export default function DocumentDialog({ document, ...props }: DocumentDialogProps) {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />

        <DialogPrimitive.Content
          className={
            'animate-in data-[state=open]:fade-in-90 sm:zoom-in-90 pointer-events-none fixed z-50 max-h-screen w-screen overflow-y-auto py-32'
          }
          onClick={() => props.onOpenChange?.(false)}
        >
          <LazyPDFViewerNoLoader
            className="mx-auto w-full max-w-3xl xl:max-w-5xl"
            document={`data:application/pdf;base64,${document}`}
            onClick={(e) => e.stopPropagation()}
          />

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none">
            <X className="h-6 w-6 text-white" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
