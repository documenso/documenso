import Link from 'next/link';

import { transferTeamOwnership } from '@documenso/lib/server-only/team/transfer-team-ownership';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

type VerifyTeamTransferPage = {
  params: {
    token: string;
  };
};

export default async function VerifyTeamTransferPage({
  params: { token },
}: VerifyTeamTransferPage) {
  const teamTransferVerification = await prisma.teamTransferVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamTransferVerification || isTokenExpired(teamTransferVerification.expiresAt)) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">არასწორი ბმული</h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            ეს ბმული არასწორია ან ვადა გაუვიდა. გთხოვთ, დაუკავშირდეთ თქვენს გუნდს ტრანსფერის
            მოთხოვნის ხელახლა გასაგზავნად.
          </p>

          <Button asChild>
            <Link href="/">დაბრუნება</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { team } = teamTransferVerification;

  let isTransferError = false;

  try {
    await transferTeamOwnership({ token });
  } catch (e) {
    console.error(e);
    isTransferError = true;
  }

  if (isTransferError) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">გუნდის მფლობელობის გადაცემა</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          გუნდის მფლობელობის გადაცემისას დაფიქსირდა ხარვეზი (<strong>{team.name}</strong>). გთხოვთ
          თავიდან სცადოთ ან დაგვიკავშირდეთ.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">გუნდის მფლობელობა გადაცემულია!</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        გუნდის (<strong>{team.name}</strong>) მფლობელობა წარმატებით გადმოგეცათ.
      </p>

      <Button asChild>
        <Link href={`/t/${team.url}/settings`}>გაგრძელება</Link>
      </Button>
    </div>
  );
}
