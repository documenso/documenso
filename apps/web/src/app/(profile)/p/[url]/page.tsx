import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FileIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { getPublicProfileByUrl } from '@documenso/lib/server-only/profile/get-public-profile-by-url';
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

export type PublicProfilePageProps = {
  params: {
    url: string;
  };
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
        <Avatar className="dark:border-border h-24 w-24 border-2 border-solid border-white">
          <AvatarFallback className="text-xs text-gray-400">
            {publicProfile.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="mt-4 flex flex-row items-center justify-center">
          <h2 className="font-bold">{publicProfile.name}</h2>

          {publicProfile.badge && (
            <Image
              className="ml-2 flex items-center justify-center"
              alt="Profile badge"
              src={`/static/${match(publicProfile.badge)
                .with('Premium', () => 'premium-user-badge.svg')
                .with('EarlySupporter', () => 'early-supporter-badge.svg')
                .exhaustive()}`}
              height={24}
              width={24}
            />
          )}
        </div>

        <div className="text-muted-foreground mt-4 max-w-lg whitespace-pre-wrap break-all text-center">
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
                          <p className="text-sm">{template.publicTitle}</p>
                          <p className="line-clamp-3 max-w-[70ch] whitespace-normal text-xs text-neutral-400">
                            {template.publicDescription}
                          </p>
                        </div>

                        <Button asChild className="w-20">
                          <Link
                            href={formatDirectTemplatePath(template.directLink.token)}
                            target="_blank"
                          >
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
