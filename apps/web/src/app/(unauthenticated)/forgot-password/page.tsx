import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '~/components/forms/forgot-password';

export const metadata: Metadata = {
  title: 'Forgot Password',
  // title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">დაგავიწყდათ პაროლი?</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          არ ინერვიულოთ! შეიყვანეთ თქვენი ელ.ფოსტა და ჩვენ გამოგიგზავნით სპეციალურ ბმულს თქვენი
          პაროლის აღსადგენად.
        </p>

        <ForgotPasswordForm className="mt-4" />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          გაგახსენდათ პაროლი?{' '}
          <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
            ავტორიზაცია
          </Link>
        </p>
      </div>
    </div>
  );
}
