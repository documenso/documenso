import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { Route } from './+types/report.$token';

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  // Only validate the token on GET. The report itself is performed by an explicit
  // mutation (triggered by the recipient clicking the button), so an automated email
  // link scanner / prefetcher cannot register a report simply by fetching the URL.
  const recipient = await prisma.recipient.findFirst({
    where: { token },
    select: { id: true },
  });

  if (!recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  return {
    token,
  };
}

export default function ReportSenderPage({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;

  const { t } = useLingui();
  const { toast } = useToast();

  const [isReported, setIsReported] = useState(false);

  const { mutate: reportSender, isPending } = trpc.envelope.recipient.report.useMutation({
    onSuccess: () => setIsReported(true),
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to report this sender at this time. Please try again later.`,
        variant: 'destructive',
      });
    },
  });

  if (isReported) {
    return (
      <div className="-mx-4 flex flex-col items-center px-4 pt-16 md:-mx-8 md:px-8 lg:pt-20 xl:pt-28">
        <h1 className="max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl">
          <Trans>Sender reported</Trans>
        </h1>

        <p className="mt-4 max-w-[60ch] text-center text-muted-foreground leading-normal">
          <Trans>
            Thank you for letting us know, we have flagged this sender for review. If you have any concerns please feel
            free to reach out to our{' '}
            <a className="text-documenso-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
              support team
            </a>
            .
          </Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 flex flex-col items-center px-4 pt-16 md:-mx-8 md:px-8 lg:pt-20 xl:pt-28">
      <h1 className="max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl">
        <Trans>Report this sender?</Trans>
      </h1>

      <p className="mt-4 max-w-[60ch] text-center text-muted-foreground leading-normal">
        <Trans>
          If you did not expect this email or believe it is spam, you can report the sender to our team for review.
        </Trans>
      </p>

      <Button className="mt-6" loading={isPending} onClick={() => reportSender({ token })}>
        <Trans>Report sender</Trans>
      </Button>
    </div>
  );
}
