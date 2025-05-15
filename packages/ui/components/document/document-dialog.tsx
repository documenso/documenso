import { useState } from 'react';

import type { DocumentData } from '@prisma/client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTrigger } from '../../primitives/dialog';
import PDFViewer from '../../primitives/pdf-viewer';

export type DocumentDialogProps = {
  trigger?: React.ReactNode;
  documentData: DocumentData;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

/**
 * A dialog which renders the provided document.
 */
export default function DocumentDialog({ trigger, documentData, ...props }: DocumentDialogProps) {
  const [documentLoaded, setDocumentLoaded] = useState(false);

  const onDocumentLoad = () => {
    setDocumentLoaded(true);
  };

  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />

        {trigger && (
          <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
            {trigger}
          </DialogTrigger>
        )}

        <DialogPrimitive.Content
          className={cn(
            'animate-in data-[state=open]:fade-in-90 sm:zoom-in-90 pointer-events-none fixed z-50 h-screen w-screen overflow-y-auto px-2 py-14 opacity-0 transition-opacity lg:py-32',
            {
              'opacity-100': documentLoaded,
            },
          )}
          onClick={() => props.onOpenChange?.(false)}
        >
          <PDFViewer
            className="mx-auto w-full max-w-3xl xl:max-w-5xl"
            documentData={documentData}
            onClick={(e) => e.stopPropagation()}
            onDocumentLoad={onDocumentLoad}
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
