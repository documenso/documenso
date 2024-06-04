import type { Metadata } from 'next';
import Link from 'next/link';

import { XCircle } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export const metadata: Metadata = {
  title: 'ელ.ფოსტის დადასტურება',
  // title: 'Verify Email',
};

export default function EmailVerificationWithoutTokenPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">როგორც ჩანს, ტოკენი გამოგრჩათ</h2>

          <p className="text-muted-foreground mt-4">
            ტოკენი არ არის მოწოდებული, თუ ცდილობთ თქვენი ელ.ფოსტის დადასტურებას, გთხოვთ, მიჰყევით
            თქვენს ელ.ფოსტაზე გამოგზანილ ბმულს.
          </p>

          <Button className="mt-4" asChild>
            <Link href="/">მთავარზე დაბრუნება</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
