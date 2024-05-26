import type { HTMLAttributes } from 'react';

import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';

export type SigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

export const SigningDisclosure = ({ className, ...props }: SigningDisclosureProps) => {
  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props}>
      თქვენი ელექტრონული ხელმოწერით, თქვენ ადასტურებთ და ეთანხმებით, რომ იგი გამოყენებული იქნება
      მოცემულ დოკუმენტზე ხელმოწერისთვის და აქვს იგივე იურიდიული ძალა, როგორიც ხელნაწერ ხელმოწერას.
      ელექტრონული ხელმოწერის პროცესის დასრულებით, თქვენ ადასტურებთ, რომ გესმით და ეთანხმებით ამ
      პირობებს.
      <span className="mt-2 block">
        იხილეთ სრულად{' '}
        <Link
          className="text-documenso-700 underline"
          href="/articles/signature-disclosure"
          target="_blank"
        >
          ხელმოწერის განცხადება
        </Link>
        .
      </span>
    </p>
  );
};
