import Link from 'next/link';

import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

type VerifyTeamEmailPageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyTeamEmailPage({ params: { token } }: VerifyTeamEmailPageProps) {
  const teamEmailVerification = await prisma.teamEmailVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamEmailVerification || isTokenExpired(teamEmailVerification.expiresAt)) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">არასწორი ბმული</h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            ეს ბმული არასწორია ან ვადა გაუვიდა. გთხოვთ, დაუკავშირდეთ თქვენს გუნდს ვერიფიკაციის
            ხელახლა გამოსაგზავნად.
          </p>

          <Button asChild>
            <Link href="/">დაბრუნება</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { team } = teamEmailVerification;

  let isTeamEmailVerificationError = false;

  try {
    await prisma.$transaction([
      prisma.teamEmailVerification.deleteMany({
        where: {
          teamId: team.id,
        },
      }),
      prisma.teamEmail.create({
        data: {
          teamId: team.id,
          email: teamEmailVerification.email,
          name: teamEmailVerification.name,
        },
      }),
    ]);
  } catch (e) {
    console.error(e);
    isTeamEmailVerificationError = true;
  }

  if (isTeamEmailVerificationError) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">გუნდის ელ.ფოსტის ვერიფიკაცია</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          {/* Something went wrong while attempting to verify your email address for{' '} */}
          <strong>{team.name}</strong>-სთვის თქვენი ელ.ფოსტის მისამართის ვერიფიკაციის მცდელობისას
          მოხდა რაღაც შეცდომა. გთხოვთ თავიდან სცადეთ.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">გუნდის ელ.ფოსტა ვერიფიცირებულია!</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        თქვენ დაადასტურეთ თქვენი ელ.ფოსტის მისამართი <strong>{team.name}</strong>-სთვის.
      </p>

      <Button asChild>
        <Link href="/">გაგრძელება</Link>
      </Button>
    </div>
  );
}
