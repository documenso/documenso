'use client';

import { useState } from 'react';

import type { Document, DocumentThumbnail, Recipient, User } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

export type DataTableTitleProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
    documentThumbnail: DocumentThumbnail;
  };
};

export const DataTableImage = ({ row }: DataTableTitleProps) => {
  const [showImageDialog, setShowImageDialog] = useState(false);

  const openDialogForImage = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    setShowImageDialog(true);
  };

  return (
    <>
      <img
        className="mr-2 inline-block h-10 w-7 cursor-pointer object-cover"
        src={row.documentThumbnail.lowResThumbnailBytes ?? '/static/document.png'}
        alt="document-preview"
        onClick={(e) => openDialogForImage(e)}
      />

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>Image</DialogTitle>
          </DialogHeader>

          <DialogDescription>High Quality Thumbnail</DialogDescription>
          <img
            className="mr-2 inline-block h-96 w-96 object-cover"
            src={row.documentThumbnail.lowResThumbnailBytes ?? '/static/document.png'}
            alt="document-preview"
            onClick={() => setShowImageDialog(true)}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowImageDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
