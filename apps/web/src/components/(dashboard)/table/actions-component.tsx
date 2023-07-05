'use client';

import React from 'react';

import { Download, Edit, Trash } from 'lucide-react';

export function ActionButtons({ documentId }: { documentId: number }) {
  return (
    <div className="flex cursor-pointer gap-6">
      <Edit
        className="text-primary h-5 w-5"
        onClick={() => {
          console.log('Edit Document with id: ', documentId);
        }}
      />
      <Download
        className="text-primary h-5 w-5"
        onClick={() => {
          console.log('Download Document with id: ', documentId);
        }}
      />
      <Trash
        className="text-primary h-5 w-5"
        onClick={() => {
          console.log('Delete Document with id: ', documentId);
        }}
      />
    </div>
  );
}
