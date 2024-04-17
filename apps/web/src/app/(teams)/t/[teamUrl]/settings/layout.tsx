import React from 'react';

import { notFound } from 'next/navigation';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import { DesktopNav } from '~/components/(teams)/settings/layout/desktop-nav';
import { MobileNav } from '~/components/(teams)/settings/layout/mobile-nav';

export type TeamSettingsLayoutProps = {
  children: React.ReactNode;
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingsLayout({
  children,
  params: { teamUrl },
}: TeamSettingsLayoutProps) {
  const session = await getRequiredServerComponentSession();

  try {
    const team = await getTeamByUrl({ userId: session.user.id, teamUrl });

    if (!canExecuteTeamAction('MANAGE_TEAM', team.currentTeamMember.role)) {
      throw new Error(AppErrorCode.UNAUTHORIZED);
    }
  } catch (e) {
    const error = AppError.parseError(e);

    if (error.code === 'P2025') {
      notFound();
    }

    throw e;
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Team Settings</h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <DesktopNav className="hidden md:col-span-3 md:flex" />
        <MobileNav className="col-span-12 mb-8 md:hidden" />

        <div className="col-span-12 md:col-span-9">{children}</div>
      </div>
    </div>
  );
}
