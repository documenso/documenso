'use client';

import React from 'react';

import { Download, Edit, Trash } from 'lucide-react';

export function ActionButtons() {
  return (
    <div className="flex cursor-pointer gap-6">
      <Edit
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Edit Button');
        }}
      />
      <Download
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Download Button');
        }}
      />
      <Trash
        size={18}
        color="#71717A"
        onClick={() => {
          console.log('Delete Button');
        }}
      />
    </div>
  );
}
