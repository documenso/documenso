import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

export const metadata: Metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">პაროლის აღდგენა ვერ მოხერხდა</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          ტოკენი, რომელიც გამოიყენეთ პაროლის გადასაყენებლად, ან ვადაგასულია, ან არ არსებობდა. თუ
          კიდევ არ გახსოვთ პაროლი, გთხოვთ მოითხოვოთ ახალი პაროლის განახლების ბმული.
        </p>

        <Button className="mt-4" asChild>
          <Link href="/signin">ავტორიზაციაზე დაბრუნება</Link>
        </Button>
      </div>
    </div>
  );
}
