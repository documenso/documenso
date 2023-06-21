'use client';

import React from 'react';

import { trpc } from '@documenso/trpc/react';

export default function Send() {
  const { mutateAsync: sendMail } = trpc.document.sendEmail.useMutation();

  return (
    <div className="p-20">
      <button
        className="rounded-md border-2 border-solid border-black px-4 py-2 text-2xl"
        onClick={async () => {
          console.log('clicked');

          await sendMail({ email: 'duncan@documenso.com' });

          alert('sent');
        }}
      >
        Send
      </button>
    </div>
  );
}
