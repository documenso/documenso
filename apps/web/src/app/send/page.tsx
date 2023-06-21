'use client';

import React, { useState } from 'react';

import { trpc } from '@documenso/trpc/react';
import { TSendMailMutationSchema } from '@documenso/trpc/server/mail-router/schema';

export default function Send() {
  const { mutateAsync: sendMail } = trpc.mail.send.useMutation();
  const [form, setForm] = useState<TSendMailMutationSchema>({
    email: '',
    type: 'invite',
    documentName: '',
    name: '',
    firstName: '',
    documentSigningLink: '',
    downloadLink: '',
    numberOfSigners: 1,
    reviewLink: '',
  });

  const handleInputChange = (event: { target: { name: any; value: unknown } }) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    console.log('clicked');

    await sendMail(form);

    alert('sent');
  };

  return (
    <div className="p-20">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="type"
          placeholder="Type"
          value={form.type}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="documentName"
          placeholder="Document Name"
          value={form.documentName}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="firstName"
          placeholder="First Name"
          value={form.firstName}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="documentSigningLink"
          placeholder="Document Signing Link"
          value={form.documentSigningLink}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="downloadLink"
          placeholder="Download Link"
          value={form.downloadLink}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="number"
          name="numberOfSigners"
          placeholder="Number of Signers"
          value={form.numberOfSigners}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          name="reviewLink"
          placeholder="Review Link"
          value={form.reviewLink}
          onChange={handleInputChange}
          required
          className="my-2 block rounded-md border-2 border-gray-300 p-2"
        />
        <button
          type="submit"
          className="mt-4 rounded-md border-2 border-solid border-black px-4 py-2 text-2xl"
        >
          Send
        </button>
      </form>
    </div>
  );
}
