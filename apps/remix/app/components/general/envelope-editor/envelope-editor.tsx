import type { EnvelopeEditorStep } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@documenso/ui/primitives/sheet';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  EyeIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  MousePointerIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { EnvelopeEditorFieldsPage } from './envelope-editor-fields-page';
import EnvelopeEditorHeader from './envelope-editor-header';
import { EnvelopeEditorMobileNotice } from './envelope-editor-mobile-notice';
import { EnvelopeEditorPreviewPage } from './envelope-editor-preview-page';
import { EnvelopeEditorQuickActions, useHasEnvelopeEditorQuickActions } from './envelope-editor-quick-actions';
import { EnvelopeEditorUploadPage } from './envelope-editor-upload-page';

type EnvelopeEditorStepData = {
  id: string;
  title: MessageDescriptor;
  /** Short label used where space is limited, such as the mobile step bar. */
  shortTitle: MessageDescriptor;
  icon: LucideIcon;
  description: MessageDescriptor;
};

const UPLOAD_STEP = {
  id: 'upload',
  title: msg`Document & Recipients`,
  shortTitle: msg`Documents`,
  icon: UploadIcon,
  description: msg`Upload documents and add recipients`,
};

const ADD_FIELDS_STEP = {
  id: 'addFields',
  title: msg`Add Fields`,
  shortTitle: msg`Fields`,
  icon: MousePointerIcon,
  description: msg`Place and configure form fields in the document`,
};

const PREVIEW_STEP = {
  id: 'preview',
  title: msg`Preview`,
  shortTitle: msg`Preview`,
  icon: EyeIcon,
  description: msg`Preview the document before sending`,
};

export const EnvelopeEditor = () => {
  const { t } = useLingui();

  const { editorConfig, isDocument, relativePath, navigateToStep, flushAutosave, resetForms } =
    useCurrentEnvelopeEditor();

  const [searchParams] = useSearchParams();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // The mobile "More" sheet holds the quick actions and the return link, so it
  // is only offered when at least one of them applies.
  const hasQuickActions = useHasEnvelopeEditorQuickActions();
  const hasMobileMenu = hasQuickActions || !editorConfig.embedded;

  const {
    general: { minimizeLeftSidebar, allowUploadAndRecipientStep, allowAddFieldsStep, allowPreviewStep },
  } = editorConfig;

  const envelopeEditorSteps = useMemo(() => {
    const steps: EnvelopeEditorStepData[] = [];

    if (allowUploadAndRecipientStep) {
      steps.push(UPLOAD_STEP);
    }

    if (allowAddFieldsStep) {
      steps.push(ADD_FIELDS_STEP);
    }

    if (allowPreviewStep) {
      steps.push(PREVIEW_STEP);
    }

    return steps.map((step, index) => ({
      ...step,
      order: index + 1,
    }));
  }, [editorConfig]);

  const searchParamsStep = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const searchParamStep = searchParams.get('step') as EnvelopeEditorStep | undefined;

    // Empty URL param equals upload, otherwise use the step URL param
    if (!searchParamStep) {
      return 'upload';
    }

    const validSteps: EnvelopeEditorStep[] = ['upload', 'addFields', 'preview'];

    if (validSteps.includes(searchParamStep)) {
      return searchParamStep;
    }

    return 'upload';
  }, [searchParams]);

  const [pageToRender, setPageToRender] = useState<EnvelopeEditorStep | 'loading'>(searchParamsStep);

  const latestStepChangeTime = useRef(0);

  const handleStepChange = async (step: EnvelopeEditorStep) => {
    setPageToRender('loading');

    const currentTime = Date.now();
    latestStepChangeTime.current = currentTime;

    await flushAutosave().then(() => {
      if (currentTime !== latestStepChangeTime.current) {
        return;
      }

      resetForms();
      setPageToRender(step);
    });
  };

  // Watch the URL params and setStep if the step changes.
  useEffect(() => {
    const stepParam = searchParams.get('step') || envelopeEditorSteps[0].id;

    const foundStep = envelopeEditorSteps.find((step) => step.id === stepParam);

    if (foundStep && foundStep.id !== pageToRender) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      void handleStepChange(foundStep.id as EnvelopeEditorStep);
    }
  }, [searchParams]);

  const currentStepData = envelopeEditorSteps.find((step) => step.id === searchParamsStep) || envelopeEditorSteps[0];

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-envelope-editor-background">
      <EnvelopeEditorHeader />

      {/* Embedded hosts control their own frame size, so the notice only applies to the full app. */}
      {!editorConfig.embedded && <EnvelopeEditorMobileNotice />}

      {/* Main Content Area */}
      <div className="flex min-h-0 w-full flex-1">
        {/* Left Section - Step Navigation. Hidden below `md`, where the bottom bar takes over. */}
        <div
          className={cn(
            'hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-border border-r bg-background py-4 md:flex',
            {
              'w-14': minimizeLeftSidebar,
            },
          )}
        >
          {/* Left section step selector. */}
          {minimizeLeftSidebar ? (
            <div className="flex justify-center px-4">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <svg className="size-10 -rotate-90" viewBox="0 0 40 40" aria-hidden>
                  {/* Track circle */}
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted"
                  />
                  {/* Progress arc */}
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 16}
                    initial={false}
                    animate={{
                      strokeDashoffset:
                        2 * Math.PI * 16 * (1 - (currentStepData.order ?? 0) / envelopeEditorSteps.length),
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-semibold text-[10px] text-foreground">
                  <Trans context="The step counter">
                    {currentStepData.order}/{envelopeEditorSteps.length}
                  </Trans>
                </span>
              </div>
            </div>
          ) : (
            <div className="px-4">
              <h3 className="flex items-end justify-between font-semibold text-foreground text-sm">
                {isDocument ? <Trans>Document Editor</Trans> : <Trans>Template Editor</Trans>}

                <span className="ml-2 rounded border bg-muted/50 px-2 py-0.5 text-muted-foreground text-xs">
                  <Trans context="The step counter">
                    Step {currentStepData.order}/{envelopeEditorSteps.length}
                  </Trans>
                </span>
              </h3>

              <div className="relative my-4 h-[4px] rounded-md bg-muted">
                <motion.div
                  layout="size"
                  layoutId="document-flow-container-step"
                  className="absolute inset-y-0 left-0 bg-primary"
                  style={{
                    width: `${(100 / envelopeEditorSteps.length) * (currentStepData.order ?? 0)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div
            className={cn('space-y-3', {
              'px-4': !minimizeLeftSidebar,
              'mt-4 flex flex-col items-center': minimizeLeftSidebar,
            })}
          >
            {envelopeEditorSteps.map((step) => {
              const Icon = step.icon;
              const isActive = searchParamsStep === step.id;

              return (
                <button
                  key={step.id}
                  data-testid={`envelope-editor-step-${step.id}`}
                  type="button"
                  className={cn(
                    `cursor-pointer rounded-lg text-left transition-colors ${
                      isActive
                        ? 'border border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
                        : 'border border-gray-200 hover:bg-gray-50 dark:border-gray-400/20 dark:hover:bg-gray-400/10'
                    }`,
                    {
                      'p-3': !minimizeLeftSidebar,
                    },
                  )}
                  onClick={() => void navigateToStep(step.id as EnvelopeEditorStep)}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`rounded border p-2 ${
                        isActive
                          ? 'border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
                          : 'border-gray-100 bg-gray-100 dark:border-gray-400/20 dark:bg-gray-400/10'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-green-600' : 'text-gray-600'}`} />
                    </div>

                    {!minimizeLeftSidebar && (
                      <div>
                        <div
                          className={`font-medium text-sm ${
                            isActive
                              ? 'text-green-900 dark:text-green-400'
                              : 'text-foreground dark:text-muted-foreground'
                          }`}
                        >
                          {t(step.title)}
                        </div>
                        <div className="text-muted-foreground text-xs">{t(step.description)}</div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Separator
            className={cn('my-6', {
              'mx-auto mb-4 w-4/5': minimizeLeftSidebar,
            })}
          />

          {/* Quick Actions. */}
          <div
            className={cn('space-y-3 px-4', {
              'px-2': minimizeLeftSidebar,
            })}
          >
            {!minimizeLeftSidebar && (
              <h4 className="font-semibold text-foreground text-sm">
                <Trans>Quick Actions</Trans>
              </h4>
            )}

            <EnvelopeEditorQuickActions showLabels={!minimizeLeftSidebar} />
          </div>

          {/* Footer of left sidebar. */}
          {!editorConfig.embedded && (
            <div
              className={cn('mt-auto px-4', {
                'px-2': minimizeLeftSidebar,
              })}
            >
              <Button
                variant="ghost"
                className={cn('w-full justify-start', {
                  'flex items-center justify-center': minimizeLeftSidebar,
                })}
                asChild
              >
                <Link to={relativePath.basePath}>
                  <ArrowLeftIcon className="h-4 w-4 flex-shrink-0" />

                  {!minimizeLeftSidebar && (
                    <span className="ml-2">
                      {isDocument ? <Trans>Return to documents</Trans> : <Trans>Return to templates</Trans>}
                    </span>
                  )}
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Main Content - Changes based on current step */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {match({
              pageToRender,
              allowUploadAndRecipientStep,
              allowAddFieldsStep,
              allowPreviewStep,
            })
              .with({ pageToRender: 'loading' }, () => <SpinnerBox className="py-32" />)
              .with({ pageToRender: 'upload', allowUploadAndRecipientStep: true }, () => <EnvelopeEditorUploadPage />)
              .with({ pageToRender: 'addFields', allowAddFieldsStep: true }, () => <EnvelopeEditorFieldsPage />)
              .with({ pageToRender: 'preview', allowPreviewStep: true }, () => <EnvelopeEditorPreviewPage />)
              .otherwise(() => null)}
          </div>

          {/* Mobile step bar. Replaces the sidebar below `md`. */}
          <nav
            className="flex h-14 shrink-0 items-stretch border-border border-t bg-background md:hidden"
            aria-label={t`Editor steps`}
          >
            {envelopeEditorSteps.map((step) => {
              const Icon = step.icon;
              const isActive = searchParamsStep === step.id;

              return (
                <button
                  key={step.id}
                  data-testid={`envelope-editor-mobile-step-${step.id}`}
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-1 font-medium text-[11px] transition-colors',
                    isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => void navigateToStep(step.id as EnvelopeEditorStep)}
                >
                  <Icon className="h-5 w-5" />
                  {t(step.shortTitle)}
                </button>
              );
            })}

            {hasMobileMenu && (
              <button
                type="button"
                className="flex flex-1 flex-col items-center justify-center gap-1 font-medium text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <MoreHorizontalIcon className="h-5 w-5" />
                <Trans>More</Trans>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile quick actions, opened from the "More" item in the step bar. */}
      {hasMobileMenu && (
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent className="flex w-full max-w-[350px] flex-col">
            <SheetHeader className="text-left">
              <SheetTitle>
                <Trans>Quick Actions</Trans>
              </SheetTitle>
            </SheetHeader>

            <EnvelopeEditorQuickActions showLabels />

            {!editorConfig.embedded && (
              <Button variant="ghost" className="mt-auto w-full justify-start" asChild>
                <Link to={relativePath.basePath}>
                  <ArrowLeftIcon className="h-4 w-4 flex-shrink-0" />

                  <span className="ml-2">
                    {isDocument ? <Trans>Return to documents</Trans> : <Trans>Return to templates</Trans>}
                  </span>
                </Link>
              </Button>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
