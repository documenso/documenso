import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { MailsIcon } from 'lucide-react';
import { Link, redirect, useSearchParams } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.signin';

export function meta() {
  return appMetaTags('Sign In');
}

export function ErrorBoundary() {
  return (
    <GenericErrorLayout
      errorCode={404}
      errorCodeMap={{
        404: {
          heading: msg`Authentication Portal Not Found`,
          subHeading: msg`404 Not Found`,
          message: msg`The organisation authentication portal does not exist, or is not configured`,
        },
      }}
      primaryButton={
        <Button asChild>
          <Link to={`/`}>
            <Trans>Go back</Trans>
          </Link>
        </Button>
      }
      secondaryButton={null}
    />
  );
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { isAuthenticated, user } = await getOptionalSession(request);

  const orgUrl = params.orgUrl;

  const organisation = await prisma.organisation.findFirst({
    where: {
      url: orgUrl,
    },
    select: {
      name: true,
      organisationClaim: true,
      organisationAuthenticationPortal: {
        select: {
          enabled: true,
        },
      },
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (
    !organisation ||
    !organisation.organisationAuthenticationPortal.enabled ||
    !organisation.organisationClaim.flags.authenticationPortal
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  // Redirect to organisation if already signed in and a member of the organisation.
  if (isAuthenticated && user && organisation.members.find((member) => member.userId === user.id)) {
    throw redirect(`/o/${orgUrl}`);
  }

  return {
    organisationName: organisation.name,
    orgUrl,
  };
}

export default function OrganisationSignIn({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  const { organisationName, orgUrl } = loaderData;

  const { t } = useLingui();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmationChecked, setIsConfirmationChecked] = useState(false);

  const action = searchParams.get('action');

  const onSignInWithOIDCClick = async () => {
    setIsSubmitting(true);

    try {
      await authClient.oidc.org.signIn({
        orgUrl,
      });
    } catch (err) {
      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to sign you In. Please try again later.`,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  if (action === 'verification-required') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <MailsIcon className="text-primary h-10 w-10" strokeWidth={2} />
          </div>
          <div className="">
            <h2 className="text-2xl font-bold md:text-4xl">
              <Trans>Confirmation email sent</Trans>
            </h2>

            <p className="text-muted-foreground mt-4">
              <Trans>
                To gain access to your account, please confirm your email address by clicking on the
                confirmation link from your inbox.
              </Trans>
            </p>

            <div className="mt-4 flex items-center gap-x-2">
              <Button asChild>
                <Link to={`/o/${orgUrl}/signin`} replace>
                  <Trans>Return</Trans>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="border-border dark:bg-background z-10 rounded-xl border bg-neutral-100 p-6">
        <h1 className="text-2xl font-semibold">
          <Trans>Welcome to {organisationName}</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Sign in to your account</Trans>
        </p>

        <hr className="-mx-6 my-4" />

        <div className="mb-4 flex items-center gap-x-2">
          <Checkbox
            id={`flag-3rd-party-service`}
            checked={isConfirmationChecked}
            onCheckedChange={(checked) =>
              setIsConfirmationChecked(checked === 'indeterminate' ? false : checked)
            }
          />

          <label
            className="text-muted-foreground ml-2 flex flex-row items-center text-sm"
            htmlFor={`flag-3rd-party-service`}
          >
            <Trans>
              I understand that I am providing my credentials to a 3rd party service configured by
              this organisation
            </Trans>
          </label>
        </div>

        <Button
          type="button"
          size="lg"
          variant="outline"
          className="bg-background w-full"
          loading={isSubmitting}
          disabled={!isConfirmationChecked}
          onClick={onSignInWithOIDCClick}
        >
          <Trans>Sign In</Trans>
        </Button>

        <div className="relative mt-2 flex items-center justify-center gap-x-4 py-2 text-xs uppercase">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground bg-transparent">
            <Trans>OR</Trans>
          </span>
          <div className="bg-border h-px flex-1" />
        </div>

        <div className="text-muted-foreground mt-1 flex items-center justify-center text-xs">
          <Link to="/signin">
            <Trans>Return to Documenso sign in page here</Trans>
          </Link>
        </div>
      </div>
    </div>
  );
}
