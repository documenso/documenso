import Link from 'next/link';

import { AlertTriangle, CheckCircle2, XCircle, XOctagon } from 'lucide-react';

import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';
import { Button } from '@documenso/ui/primitives/button';

export type PageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyEmailPage({ params: { token } }: PageProps) {
  if (!token) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <div className="mb-4 text-red-300">
            <XOctagon />
          </div>

          <h2 className="text-4xl font-semibold">No token provided</h2>
          <p className="text-muted-foreground mt-2 text-base">
            It seems that there is no token provided. Please check your email and try again.
          </p>
        </div>
      </div>
    );
  }

  const verified = await verifyEmail({ token });

  if (verified === null) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <AlertTriangle className="h-10 w-10 text-yellow-500" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">დაფიქსირდა ხარვეზი</h2>

            <p className="text-muted-foreground mt-4">
              We were unable to verify your email. If your email is not verified already, please try
              again.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">მთავარზე დაბრუნება</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">ტოკენს ვადა გაუვიდა!</h2>

            <p className="text-muted-foreground mt-4">
              როგორც ჩანს, თქვენ მიერ მოწოდებულ ტოკენს ვადა გაუვიდა. ჩვენ ახლახან გამოგიგზავნეთ
              ახალი ტოკენი, გთხოვთ შეამოწმოთ თქვენი ელ. ფოსტა და სცადოთ ხელახლა.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">მთავარზე დაბრუნება</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">ელ. ფოსტა დადასტურებულია!</h2>

          <p className="text-muted-foreground mt-4">
            თქვენი ელ. ფოსტა წარმატებით დადასტურდა! ახლა შეგიძლიათ გამოიყენოთ "ჩიქოვანები"-ს ყველა
            ფუნქცია.
          </p>

          <Button className="mt-4" asChild>
            <Link href="/">მთავარზე დაბრუნება</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
