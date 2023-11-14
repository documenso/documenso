'use client';

import { useState } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { DocumentData } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';
import { Dialog, DialogOverlay, DialogPortal } from '../../primitives/dialog';
import { LazyPDFViewerNoLoader } from '../../primitives/lazy-pdf-viewer';

export type DocumentDialogProps = {
  documentData: DocumentData;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

/**
 * A dialog which renders the provided document.
 */
export default function DocumentDialog({ documentData, ...props }: DocumentDialogProps) {
  const [documentLoaded, setDocumentLoaded] = useState(false);

  const onDocumentLoad = () => {
    setDocumentLoaded(true);
  };

  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />

        <DialogPrimitive.Content
          className={cn(
            'animate-in data-[state=open]:fade-in-90 sm:zoom-in-90 pointer-events-none fixed z-50 h-screen w-screen overflow-y-auto px-2 py-14 opacity-0 transition-opacity lg:py-32',
            {
              'opacity-100': documentLoaded,
            },
          )}
          onClick={() => props.onOpenChange?.(false)}
        >
          <LazyPDFViewerNoLoader
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
