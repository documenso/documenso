import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

export const metadata: Metadata = {
  title: 'დაგავიწყდათ პაროლი?',
  // title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">მეილი გამოგზავნილია!</h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          პაროლის აღდგენის მეილი გაიგზავნა თქვენი ელ.ფოსტის ანგარიშზე.
        </p>

        <Button asChild>
          <Link href="/signin">უკან დაბრუნება</Link>
        </Button>
      </div>
    </div>
  );
}
