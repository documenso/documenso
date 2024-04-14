'use client';

import dynamic from 'next/dynamic';

const Docs = dynamic(async () => import('@documenso/api/v1/api-documentation'), {
  ssr: false,
});

export default function OpenApiDocsPage() {
  return <Docs />;
}
