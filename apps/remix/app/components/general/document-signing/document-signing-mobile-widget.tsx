import { useEffect, useState } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { motion } from 'framer-motion';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { match } from 'ts-pattern';

import { Button } from '@documenso/ui/primitives/button';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';

import { BrandingLogo } from '../branding-logo';
import EnvelopeSignerForm from '../envelope-signing/envelope-signer-form';
import { EnvelopeSignerCompleteDialog } from '../envelope-signing/envelope-signing-complete-dialog';
import { useRequiredEnvelopeSigningContext } from './envelope-signing-provider';

export const DocumentSigningMobileWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { hidePoweredBy = true } = useEmbedSigningContext() || {};

  const { recipientFieldsRemaining, recipient, requiredRecipientFields } =
    useRequiredEnvelopeSigningContext();

  /**
   * Pre open the widget for assistants to let them know it's there.
   */
  useEffect(() => {
    if (recipient.role === RecipientRole.ASSISTANT) {
      setIsExpanded(true);
    }
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-2 pb-2 sm:px-4 sm:pb-6">
      <div className="pointer-events-auto w-full max-w-[760px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Main Header Bar */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {recipient.role !== RecipientRole.VIEWER && (
                  <Button
                    variant="outline"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex h-8 w-8 items-center justify-center"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <LucideChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <LucideChevronUp className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                  </Button>
                )}

                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {match(recipient.role)
                      .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
                      .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
                      .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
                      .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
                      .otherwise(() => null)}
                  </h2>

                  <p className="-mt-0.5 text-sm text-muted-foreground">
                    {recipientFieldsRemaining.length === 0 ? (
                      match(recipient.role)
                        .with(RecipientRole.VIEWER, () => (
                          <Trans>Please mark as viewed to complete</Trans>
                        ))
                        .with(RecipientRole.SIGNER, () => (
                          <Trans>Please complete the document once reviewed</Trans>
                        ))
                        .with(RecipientRole.APPROVER, () => (
                          <Trans>Please complete the document once reviewed</Trans>
                        ))
                        .with(RecipientRole.ASSISTANT, () => (
                          <Trans>Please complete the document once reviewed</Trans>
                        ))
                        .otherwise(() => null)
                    ) : (
                      <Plural
                        value={recipientFieldsRemaining.length}
                        one="1 Field Remaining"
                        other="# Fields Remaining"
                      />
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <EnvelopeSignerCompleteDialog />
            </div>
          </div>

          {/* Progress Bar */}
          {recipient.role !== RecipientRole.VIEWER &&
            recipient.role !== RecipientRole.ASSISTANT && (
              <div className="px-4 pb-3">
                <div className="relative h-[4px] rounded-md bg-muted">
                  <motion.div
                    layout="size"
                    layoutId="document-signing-mobile-widget-progress-bar"
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{
                      width: `${100 - (100 / requiredRecipientFields.length) * (recipientFieldsRemaining.length ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
            )}

          {/* Expandable Content */}
          {isExpanded && (
            <div className="border-t border-border p-4 duration-200 animate-in slide-in-from-bottom-2">
              <EnvelopeSignerForm />

              {!hidePoweredBy && (
                <div className="mt-2 inline-block rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground opacity-60 hover:opacity-100 lg:hidden">
                  <span>Powered by</span>
                  <BrandingLogo className="ml-2 inline-block h-[14px]" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
