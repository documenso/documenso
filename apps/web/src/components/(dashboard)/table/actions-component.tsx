'use client';

import React from 'react';

import { Download, Edit, Trash } from 'lucide-react';

export function ActionButtons({ documentId }: { documentId: number }) {
  return (
    <div className="flex cursor-pointer gap-6">
      <Edit
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Edit Document with id: ', documentId);
        }}
      />
      <Download
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Download Document with id: ', documentId);
        }}
      />
      <Trash
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Delete Document with id: ', documentId);
        }}
      />
    </div>
  );
}
