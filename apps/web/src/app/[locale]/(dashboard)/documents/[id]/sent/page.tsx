import Link from 'next/link';

import { ChevronLeft } from 'lucide-react';

export default function DocumentSentPage() {
  return (
    <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
      <Link href="/documents" className="flex grow-0 items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Documents
      </Link>

      <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
        Loading Document...
      </h1>
    </div>
  );
}
