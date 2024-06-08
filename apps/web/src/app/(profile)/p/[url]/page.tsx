import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FileIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import { getPublicProfileByUrl } from '@documenso/lib/server-only/profile/get-public-profile-by-url';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
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

  const { profile, templates } = publicProfile;

  return (
    <div className="flex flex-col items-center justify-center py-4 sm:py-32">
      <div className="flex flex-col items-center">
        <Avatar className="dark:border-border h-24 w-24 border-2 border-solid">
          <AvatarFallback className="text-xs text-gray-400">
            {extractInitials(publicProfile.name)}
          </AvatarFallback>
        </Avatar>

        <div className="mt-4 flex flex-row items-center justify-center">
          <h2 className="font-bold">{publicProfile.name}</h2>

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
                  <p className="text-foreground text-base font-bold">
                    {BADGE_DATA[publicProfile.badge.type].name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Since {DateTime.fromJSDate(publicProfile.badge.since).toFormat('LLL ‘yy')}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="text-muted-foreground mt-4 max-w-lg whitespace-pre-wrap break-words text-center">
          {profile.bio}
        </div>
      </div>

      {templates.length > 0 && (
        <div className="mt-8 w-full max-w-3xl rounded-md border">
          <Table className="w-full" overflowHidden>
            <TableHeader>
              <TableRow>
                <TableHead className="w-full rounded-tl-md bg-neutral-50 dark:bg-neutral-700">
                  Documents
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="text-muted-foreground flex flex-col justify-between overflow-hidden text-sm sm:flex-row">
                    <div className="flex flex-1 items-start gap-2">
                      <FileIcon
                        className="text-muted-foreground/40 h-8 w-8 flex-shrink-0"
                        strokeWidth={1.5}
                      />

                      <div className="flex flex-1 flex-col gap-4 overflow-hidden md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-bold">{template.publicTitle}</p>
                          <p className="line-clamp-3 max-w-[70ch] whitespace-normal text-xs text-neutral-400">
                            {template.publicDescription}
                          </p>
                        </div>

                        <Button asChild className="w-20">
                          <Link href={formatDirectTemplatePath(template.directLink.token)}>
                            Sign
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
