import Link from 'next/link';

import { DateTime } from 'luxon';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { acceptTeamInvitation } from '@documenso/lib/server-only/team/accept-team-invitation';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { prisma } from '@documenso/prisma';
import { TeamMemberInviteStatus } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

type AcceptInvitationPageProps = {
  params: {
    token: string;
  };
};

export default async function AcceptInvitationPage({
  params: { token },
}: AcceptInvitationPageProps) {
  const session = await getServerComponentSession();

  const teamMemberInvite = await prisma.teamMemberInvite.findUnique({
    where: {
      token,
    },
  });

  if (!teamMemberInvite) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">არასწორი ტოკენი</h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            ეს ტოკენი არასწორია ან ვადა გაუვიდა. გთხოვთ, დაუკავშირდეთ თქვენს გუნდს ახალი
            მოწვევისთვის.
          </p>

          <Button asChild>
            <Link href="/">დაბრუნება</Link>
          </Button>
        </div>
      </div>
    );
  }

  const team = await getTeamById({ teamId: teamMemberInvite.teamId });

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: teamMemberInvite.email,
        mode: 'insensitive',
      },
    },
  });

  // Directly convert the team member invite to a team member if they already have an account.
  if (user) {
    await acceptTeamInvitation({ userId: user.id, teamId: team.id });
  }

  // For users who do not exist yet, set the team invite status to accepted, which is checked during
  // user creation to determine if we should add the user to the team at that time.
  if (!user && teamMemberInvite.status !== TeamMemberInviteStatus.ACCEPTED) {
    await prisma.teamMemberInvite.update({
      where: {
        id: teamMemberInvite.id,
      },
      data: {
        status: TeamMemberInviteStatus.ACCEPTED,
      },
    });
  }

  const email = encryptSecondaryData({
    data: teamMemberInvite.email,
    expiresAt: DateTime.now().plus({ days: 1 }).toMillis(),
  });

  if (!user) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">გუნდის მოწვევა</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          თქვენ გუნდში მოგიწვიათ <strong>{team.name}</strong>-მა.
        </p>

        <p className="text-muted-foreground mb-4 mt-1 text-sm">
          ამ მოწვევის მისაღებად თქვენ უნდა შექმნათ ანგარიში.
        </p>

        <Button asChild>
          <Link href={`/signup?email=${encodeURIComponent(email)}`}>ანგარიშის შექმნა</Link>
        </Button>
      </div>
    );
  }

  const isSessionUserTheInvitedUser = user.id === session.user?.id;

  return (
    <div>
      <h1 className="text-4xl font-semibold">მოწვევა მიღებულია!</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        თქვენ დაადასტურეთ <strong>{team.name}</strong>-ის გუნდის მოწვევა.
      </p>

      {isSessionUserTheInvitedUser ? (
        <Button asChild>
          <Link href="/">გაგრძელება</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href={`/signin?email=${encodeURIComponent(email)}`}>რეგისტრაციის გაგრძელება</Link>
        </Button>
      )}
    </div>
  );
}
