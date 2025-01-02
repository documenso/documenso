import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';

import { useOptionalCurrentTeam } from '~/providers/team';

type ErrorCodeMap = Record<
  number,
  { subHeading: MessageDescriptor; heading: MessageDescriptor; message: MessageDescriptor }
>;

export type GenericErrorLayoutProps = {
  children?: React.ReactNode;
  errorCode?: number;
  errorCodeMap?: ErrorCodeMap;
  /**
   * The primary button to display. If left as undefined, the default /documents link will be displayed.
   *
   * Set to null if you want no button.
   */
  primaryButton?: React.ReactNode | null;

  /**
   * The secondary button to display. If left as undefined, the default back button will be displayed.
   *
   * Set to null if you want no button.
   */
  secondaryButton?: React.ReactNode | null;
};

export const defaultErrorCodeMap: ErrorCodeMap = {
  404: {
    subHeading: msg`404 not found`,
    heading: msg`Oops! Something went wrong.`,
    message: msg`The page you are looking for was moved, removed, renamed or might never have existed.`,
  },
  500: {
    subHeading: msg`500 Internal Server Error`,
    heading: msg`Oops! Something went wrong.`,
    message: msg`An unexpected error occurred.`,
  },
};

export const GenericErrorLayout = ({
  children,
  errorCode,
  errorCodeMap = defaultErrorCodeMap,
  primaryButton,
  secondaryButton,
}: GenericErrorLayoutProps) => {
  const navigate = useNavigate();
  const { _ } = useLingui();

  const team = useOptionalCurrentTeam();

  const { subHeading, heading, message } =
    errorCodeMap[errorCode || 500] ?? defaultErrorCodeMap[500];

  return (
    <div className="fixed inset-0 z-0 flex h-screen w-screen items-center justify-center">
      <div className="absolute -inset-24 -z-10">
        <motion.div
          className="flex h-full w-full items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8, transition: { duration: 0.5, delay: 0.5 } }}
        >
          <img
            src={backgroundPattern}
            alt="background pattern"
            className="-ml-[50vw] -mt-[15vh] h-full scale-100 object-cover md:scale-100 lg:scale-[100%] dark:contrast-[70%] dark:invert dark:sepia"
            style={{
              mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            }}
          />
        </motion.div>
      </div>

      <div className="inset-0 mx-auto flex h-full flex-grow items-center justify-center px-6 py-32">
        <div>
          <p className="text-muted-foreground font-semibold">{_(subHeading)}</p>

          <h1 className="mt-3 text-2xl font-bold md:text-3xl">{_(heading)}</h1>

          <p className="text-muted-foreground mt-4 text-sm">{_(message)}</p>

          <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
            {secondaryButton ||
              (secondaryButton !== null && (
                <Button
                  variant="ghost"
                  className="w-32"
                  onClick={() => {
                    void navigate(-1);
                  }}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  <Trans>Go Back</Trans>
                </Button>
              ))}

            {primaryButton ||
              (primaryButton !== null && (
                <Button asChild>
                  <Link to={formatDocumentsPath(team?.url)}>
                    <Trans>Documents</Trans>
                  </Link>
                </Button>
              ))}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
