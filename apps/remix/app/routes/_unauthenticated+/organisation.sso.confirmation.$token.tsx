import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle, Building2, Database, Eye, Settings, UserCircle2 } from 'lucide-react';
import { data, isRouteErrorResponse } from 'react-router';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';

import { ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER } from '@documenso/lib/constants/organisations';
import { ZOrganisationAccountLinkMetadataSchema } from '@documenso/lib/types/organisation';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatOrganisationLoginPath } from '@documenso/lib/utils/organisation-authentication-portal';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Separator } from '@documenso/ui/primitives/separator';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { GenericErrorLayout, defaultErrorCodeMap } from '~/components/general/generic-error-layout';

import type { Route } from './+types/organisation.sso.confirmation.$token';

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.data.type : 500;

  const errorMap = match(errorCode)
    .with('invalid-token', () => ({
      subHeading: msg`400 Error`,
      heading: msg`Invalid Token`,
      message: msg`The token is invalid or has expired.`,
    }))
    .otherwise(() => defaultErrorCodeMap[500]);

  return (
    <GenericErrorLayout errorCode={500} errorCodeMap={{ 500: errorMap }} secondaryButton={null} />
  );
}

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    throw data({
      type: 'invalid-token',
    });
  }

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          avatarImageId: true,
        },
      },
    },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    throw data({
      type: 'invalid-token',
    });
  }

  const metadata = ZOrganisationAccountLinkMetadataSchema.safeParse(verificationToken.metadata);

  if (!metadata.success) {
    throw data({
      type: 'invalid-token',
    });
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      id: metadata.data.organisationId,
    },
    select: {
      name: true,
      url: true,
      avatarImageId: true,
    },
  });

  if (!organisation) {
    throw data({
      type: 'invalid-token',
    });
  }

  return {
    token,
    type: metadata.data.type,
    user: {
      name: verificationToken.user.name,
      email: verificationToken.user.email,
      avatar: verificationToken.user.avatarImageId,
    },
    organisation: {
      name: organisation.name,
      url: organisation.url,
      avatar: organisation.avatarImageId,
    },
  } as const;
}

export default function OrganisationSsoConfirmationTokenPage({ loaderData }: Route.ComponentProps) {
  const { token, type, user, organisation } = loaderData;

  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isConfirmationChecked, setIsConfirmationChecked] = useState(false);

  const { mutate: declineLinkOrganisationAccount, isPending: isDeclining } =
    trpc.enterprise.organisation.authenticationPortal.declineLinkAccount.useMutation({
      onSuccess: async () => {
        await navigate('/');

        toast({
          title: _(msg`Account link declined`),
        });
      },
      onError: (error) => {
        toast({
          title: _(msg`Error declining account link`),
          description: error.message,
        });
      },
    });

  const { mutate: linkOrganisationAccount, isPending: isLinking } =
    trpc.enterprise.organisation.authenticationPortal.linkAccount.useMutation({
      onSuccess: async () => {
        await navigate(formatOrganisationLoginPath(organisation.url));

        toast({
          title: _(msg`Account linked successfully`),
        });
      },
      onError: (error) => {
        toast({
          title: _(msg`Error linking account`),
          description: error.message,
        });
      },
    });

  return (
    <div>
      <Card className="w-full max-w-2xl border">
        <CardHeader>
          <CardTitle>
            {type === 'link' ? (
              <Trans>Account Linking Request</Trans>
            ) : (
              <Trans>Account Creation Request</Trans>
            )}
          </CardTitle>
          <CardDescription>
            {type === 'link' ? (
              <Trans>
                An organisation wants to link your account. Please review the details below.
              </Trans>
            ) : (
              <Trans>
                An organisation wants to create an account for you. Please review the details below.
              </Trans>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current User Section */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground flex items-center gap-2 font-semibold">
              <UserCircle2 className="h-4 w-4" />
              <Trans>Your Account</Trans>
            </h3>
            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg p-3">
              <AvatarWithText
                avatarSrc={formatAvatarUrl(user.avatar)}
                avatarFallback={extractInitials(user.name || user.email)}
                primaryText={user.name}
                secondaryText={user.email}
              />

              <Badge variant="secondary">
                <Trans>Account</Trans>
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Organisation Section */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground flex items-center gap-2 font-semibold">
              <Building2 className="h-4 w-4" />
              <Trans>Requesting Organisation</Trans>
            </h3>
            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg p-3">
              <AvatarWithText
                avatarSrc={formatAvatarUrl(organisation.avatar)}
                avatarFallback={extractInitials(organisation.name)}
                primaryText={organisation.name}
                secondaryText={`/o/${organisation.url}`}
              />

              <Badge variant="secondary">
                <Trans>Organisation</Trans>
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Warnings Section */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <Trans>Important: What This Means</Trans>
            </h3>
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                <Trans>
                  By accepting this request, you grant {organisation.name} the following
                  permissions:
                </Trans>
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Eye className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    <Trans>
                      <span className="text-muted-foreground font-semibold">
                        Full account access:
                      </span>{' '}
                      View all your profile information, settings, and activity
                    </Trans>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Settings className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    <Trans>
                      <span className="text-muted-foreground font-semibold">
                        Account management:
                      </span>{' '}
                      Modify your account settings, permissions, and preferences
                    </Trans>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    <Trans>
                      <span className="text-muted-foreground font-semibold">Data access:</span>{' '}
                      Access all data associated with your account
                    </Trans>
                  </span>
                </li>
              </ul>

              <Alert variant="warning" className="mt-3">
                <AlertDescription>
                  <Trans>
                    This organisation will have administrative control over your account. You can
                    revoke this access later, but they will retain access to any data they've
                    already collected.
                  </Trans>
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-x-2">
            <Checkbox
              id={`accept-conditions`}
              checked={isConfirmationChecked}
              onCheckedChange={(checked) =>
                setIsConfirmationChecked(checked === 'indeterminate' ? false : checked)
              }
            />

            <label
              className="text-muted-foreground ml-2 flex flex-row items-center text-sm"
              htmlFor={`accept-conditions`}
            >
              <Trans>I agree to link my account with this organization</Trans>
            </label>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={isDeclining || isLinking}
            onClick={() => declineLinkOrganisationAccount({ token })}
          >
            <Trans>Decline</Trans>
          </Button>

          <Button
            disabled={!isConfirmationChecked || isDeclining || isLinking}
            loading={isLinking}
            onClick={() => linkOrganisationAccount({ token })}
          >
            <Trans>Accept & Link Account</Trans>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
