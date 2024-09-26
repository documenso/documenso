import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { FileIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getPublicProfileByUrl } from '@documenso/lib/server-only/profile/get-public-profile-by-url';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type PublicProfilePageProps = {
  params: {
    url: string;
  };
};

const BADGE_DATA = {
  Premium: {
    imageSrc: '/static/premium-user-badge.svg',
    name: 'Premium',
  },
  EarlySupporter: {
    imageSrc: '/static/early-supporter-badge.svg',
    name: 'Early supporter',
  },
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  setupI18nSSR();

  const { url: profileUrl } = params;

  if (!profileUrl) {
    redirect('/');
  }

  const publicProfile = await getPublicProfileByUrl({
    profileUrl,
  }).catch(() => null);

  if (!publicProfile || !publicProfile.profile.enabled) {
    notFound();
  }

  const { user } = await getServerComponentSession();

  const { profile, templates } = publicProfile;

  return (
    <div className="flex flex-col items-center justify-center py-4 sm:py-32">
      <div className="flex flex-col items-center">
        <Avatar className="dark:border-border h-24 w-24 border-2 border-solid">
          {publicProfile.avatarImageId && (
            <AvatarImage
              src={`${NEXT_PUBLIC_WEBAPP_URL()}/api/avatar/${publicProfile.avatarImageId}`}
            />
          )}

          <AvatarFallback className="text-sm text-gray-400">
            {extractInitials(publicProfile.name)}
          </AvatarFallback>
        </Avatar>

        <div className="mt-4 flex flex-row items-center justify-center">
          <h2 className="text-xl font-semibold md:text-2xl">{publicProfile.name}</h2>

          {publicProfile.badge && (
            <Tooltip>
              <TooltipTrigger>
                <Image
                  className="ml-2 flex items-center justify-center"
                  alt="Profile badge"
                  src={BADGE_DATA[publicProfile.badge.type].imageSrc}
                  height={24}
                  width={24}
                />
              </TooltipTrigger>

              <TooltipContent className="flex flex-row items-start py-2 !pl-3 !pr-3.5">
                <Image
                  className="mt-0.5"
                  alt="Profile badge"
                  src={BADGE_DATA[publicProfile.badge.type].imageSrc}
                  height={24}
                  width={24}
                />

                <div className="ml-2">
                  <p className="text-foreground text-base font-semibold">
                    {BADGE_DATA[publicProfile.badge.type].name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    <Trans>
                      Since {DateTime.fromJSDate(publicProfile.badge.since).toFormat('LLL ‘yy')}
                    </Trans>
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="text-muted-foreground mt-4 space-y-1">
          {(profile.bio ?? '').split('\n').map((line, index) => (
            <p
              key={index}
              className="max-w-[60ch] whitespace-pre-wrap break-words text-center text-sm"
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      {templates.length === 0 && (
        <div className="mt-4 w-full max-w-xl border-t pt-4">
          <p className="text-muted-foreground max-w-[60ch] whitespace-pre-wrap break-words text-center text-sm leading-relaxed">
            <Trans>
              It looks like {publicProfile.name} hasn't added any documents to their profile yet.
            </Trans>{' '}
            {!user?.id && (
              <span className="mt-2 inline-block">
                <Trans>
                  While waiting for them to do so you can create your own Documenso account and get
                  started with document signing right away.
                </Trans>
              </span>
            )}
            {'userId' in profile && user?.id === profile.userId && (
              <span className="mt-2 inline-block">
                <Trans>
                  Go to your{' '}
                  <Link href="/settings/public-profile" className="underline">
                    public profile settings
                  </Link>{' '}
                  to add documents.
                </Trans>
              </span>
            )}
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="mt-8 w-full max-w-xl rounded-md border">
          <Table className="w-full" overflowHidden>
            <TableHeader>
              <TableRow>
                <TableHead className="w-full rounded-tl-md bg-neutral-50 dark:bg-neutral-700">
                  <Trans>Documents</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="text-muted-foreground flex flex-col justify-between overflow-hidden text-sm sm:flex-row">
                    <div className="flex flex-1 items-start justify-start gap-2">
                      <FileIcon
                        className="text-muted-foreground/40 h-8 w-8 flex-shrink-0"
                        strokeWidth={1.5}
                      />

                      <div className="flex flex-1 flex-col gap-4 overflow-hidden md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-foreground text-sm font-semibold leading-none">
                            {template.publicTitle}
                          </p>
                          <p className="text-muted-foreground mt-1 line-clamp-3 max-w-[70ch] whitespace-normal text-xs">
                            {template.publicDescription}
                          </p>
                        </div>

                        <Button asChild className="w-20">
                          <Link href={formatDirectTemplatePath(template.directLink.token)}>
                            <Trans>Sign</Trans>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
