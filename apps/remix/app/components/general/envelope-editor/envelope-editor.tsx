import type { EnvelopeEditorStep } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyPlusIcon,
  DownloadCloudIcon,
  EyeIcon,
  FileOutputIcon,
  LinkIcon,
  type LucideIcon,
  MousePointerIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { EnvelopeDeleteDialog } from '~/components/dialogs/envelope-delete-dialog';
import { EnvelopeDistributeDialog } from '~/components/dialogs/envelope-distribute-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopeDuplicateDialog } from '~/components/dialogs/envelope-duplicate-dialog';
import { EnvelopeRedistributeDialog } from '~/components/dialogs/envelope-redistribute-dialog';
import { EnvelopeSaveAsTemplateDialog } from '~/components/dialogs/envelope-save-as-template-dialog';
import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';
import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';

import { EnvelopeEditorFieldsPage } from './envelope-editor-fields-page';
import EnvelopeEditorHeader from './envelope-editor-header';
import { EnvelopeEditorPreviewPage } from './envelope-editor-preview-page';
import { EnvelopeEditorUploadPage } from './envelope-editor-upload-page';

type EnvelopeEditorStepData = {
  id: string;
  title: MessageDescriptor;
  icon: LucideIcon;
  description: MessageDescriptor;
};

const UPLOAD_STEP = {
  id: 'upload',
  title: msg`Document & Recipients`,
  icon: UploadIcon,
  description: msg`Upload documents and add recipients`,
};

const ADD_FIELDS_STEP = {
  id: 'addFields',
  title: msg`Add Fields`,
  icon: MousePointerIcon,
  description: msg`Place and configure form fields in the document`,
};

const PREVIEW_STEP = {
  id: 'preview',
  title: msg`Preview`,
  icon: EyeIcon,
  description: msg`Preview the document before sending`,
};

export const EnvelopeEditor = () => {
  const { t } = useLingui();

  const navigate = useNavigate();

  const {
    envelope,
    editorConfig,
    isDocument,
    isTemplate,
    relativePath,
    navigateToStep,
    syncEnvelope,
    flushAutosave,
    resetForms,
  } = useCurrentEnvelopeEditor();

  const [searchParams, setSearchParams] = useSearchParams();

  const {
    general: { minimizeLeftSidebar, allowUploadAndRecipientStep, allowAddFieldsStep, allowPreviewStep },
    actions: {
      allowDistributing,
      allowDirectLink,
      allowDuplication,
      allowSaveAsTemplate,
      allowDownloadPDF,
      allowDeletion,
    },
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
    <div className="h-screen w-screen bg-envelope-editor-background">
      <EnvelopeEditorHeader />

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-4rem)] w-screen">
        {/* Left Section - Step Navigation */}
        <div
          className={cn('flex w-80 flex-shrink-0 flex-col overflow-y-auto border-border border-r bg-background py-4', {
            'w-14': minimizeLeftSidebar,
          })}
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
              <h3 className="flex items-baseline justify-between font-semibold text-foreground text-sm tracking-tight">
                {isDocument ? <Trans>Document Editor</Trans> : <Trans>Template Editor</Trans>}

                <span className="text-muted-foreground text-xs tabular-nums">
                  <Trans context="The step counter">
                    Step {currentStepData.order}/{envelopeEditorSteps.length}
                  </Trans>
                </span>
              </h3>
            </div>
          )}

          <nav
            className={cn('flex flex-col', {
              'mt-5 px-4': !minimizeLeftSidebar,
              'mt-4 items-center': minimizeLeftSidebar,
            })}
          >
            {envelopeEditorSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = searchParamsStep === step.id;
              const isCompleted = (currentStepData.order ?? 0) > step.order;
              const isLast = index === envelopeEditorSteps.length - 1;

              return (
                <button
                  key={step.id}
                  data-testid={`envelope-editor-step-${step.id}`}
                  type="button"
                  title={minimizeLeftSidebar ? t(step.title) : undefined}
                  aria-current={isActive ? 'step' : undefined}
                  className="group flex cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => void navigateToStep(step.id as EnvelopeEditorStep)}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition-[color,border-color,background-color,box-shadow] duration-150',
                        {
                          'border-primary bg-primary text-primary-foreground': isCompleted,
                          'border-primary bg-primary/10 text-documenso-700 ring-4 ring-primary/10 dark:text-primary':
                            isActive,
                          'border-border bg-background text-muted-foreground group-hover:border-muted-foreground/40 group-hover:text-foreground':
                            !isActive && !isCompleted,
                        },
                      )}
                    >
                      {isCompleted ? (
                        <motion.span
                          className="flex"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                        </motion.span>
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {!isLast && (
                      <div className="relative my-1 min-h-4 w-px flex-1 overflow-hidden bg-border">
                        <motion.div
                          className="absolute inset-x-0 top-0 bg-primary"
                          initial={false}
                          animate={{ height: isCompleted ? '100%' : '0%' }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      </div>
                    )}
                  </div>

                  {!minimizeLeftSidebar && (
                    <div className={cn('ml-3 min-w-0 pt-1', !isLast && 'pb-5')}>
                      <div
                        className={cn('font-medium text-sm transition-colors duration-150', {
                          'text-documenso-800 dark:text-primary': isActive,
                          'text-foreground': isCompleted,
                          'text-muted-foreground group-hover:text-foreground': !isActive && !isCompleted,
                        })}
                      >
                        {t(step.title)}
                      </div>

                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.div
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                          >
                            <div className="mt-0.5 text-muted-foreground text-xs">{t(step.description)}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          <Separator
            className={cn('my-5', {
              'mx-auto mb-4 w-4/5': minimizeLeftSidebar,
            })}
          />

          {/* Quick Actions. */}
          <div
            className={cn('space-y-1 px-4 [&_.lucide]:text-muted-foreground', {
              'px-2': minimizeLeftSidebar,
            })}
          >
            {!minimizeLeftSidebar && (
              <h4 className="mb-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                <Trans>Quick Actions</Trans>
              </h4>
            )}

            {editorConfig.settings && (
              <EnvelopeEditorSettingsDialog
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Settings`)}>
                    <SettingsIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? <Trans>Document Settings</Trans> : <Trans>Template Settings</Trans>}
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {isDocument && allowDistributing && (
              <>
                <EnvelopeDistributeDialog
                  documentRootPath={relativePath.documentRootPath}
                  trigger={
                    <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Send Envelope`)}>
                      <SendIcon className="h-4 w-4" />

                      {!minimizeLeftSidebar && (
                        <span className="ml-2">
                          <Trans>Send Document</Trans>
                        </span>
                      )}
                    </Button>
                  }
                />

                <EnvelopeRedistributeDialog
                  envelope={envelope}
                  trigger={
                    <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Resend Envelope`)}>
                      <SendIcon className="h-4 w-4" />

                      {!minimizeLeftSidebar && (
                        <span className="ml-2">
                          <Trans>Resend Document</Trans>
                        </span>
                      )}
                    </Button>
                  }
                />
              </>
            )}

            {isTemplate && allowDirectLink && (
              <TemplateDirectLinkDialog
                templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
                directLink={envelope.directLink}
                recipients={envelope.recipients}
                onCreateSuccess={async () => await syncEnvelope()}
                onDeleteSuccess={async () => await syncEnvelope()}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Direct Link`)}>
                    <LinkIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        <Trans>Direct Link</Trans>
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {allowDuplication && (
              <EnvelopeDuplicateDialog
                envelopeId={envelope.id}
                envelopeType={envelope.type}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Duplicate Envelope`)}>
                    <CopyPlusIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? <Trans>Duplicate Document</Trans> : <Trans>Duplicate Template</Trans>}
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {allowSaveAsTemplate && isDocument && (
              <EnvelopeSaveAsTemplateDialog
                envelopeId={envelope.id}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Save as Template`)}>
                    <FileOutputIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        <Trans>Save as Template</Trans>
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {allowDownloadPDF && (
              <EnvelopeDownloadDialog
                envelopeId={envelope.id}
                envelopeStatus={envelope.status}
                isLegacy={envelope.internalVersion === 1}
                envelopeItems={envelope.envelopeItems}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start" title={t(msg`Download PDF`)}>
                    <DownloadCloudIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        <Trans>Download PDF</Trans>
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {/* Check envelope ID since it can be in embedded create mode. */}
            {allowDeletion && envelope.id && (
              <EnvelopeDeleteDialog
                id={envelope.id}
                type={envelope.type}
                status={envelope.status}
                title={envelope.title}
                canManageDocument={true}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start hover:bg-destructive/10 hover:text-destructive hover:[&_.lucide]:text-destructive"
                    title={t(msg`Delete Envelope`)}
                  >
                    <Trash2Icon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? <Trans>Delete Document</Trans> : <Trans>Delete Template</Trans>}
                      </span>
                    )}
                  </Button>
                }
                onDelete={async () => {
                  await navigate(
                    envelope.type === EnvelopeType.DOCUMENT
                      ? relativePath.documentRootPath
                      : relativePath.templateRootPath,
                  );
                }}
              />
            )}
          </div>

          {/* Footer of left sidebar. */}
          {!editorConfig.embedded && (
            <div
              className={cn('mt-auto border-border border-t px-4 pt-3', {
                'px-2': minimizeLeftSidebar,
              })}
            >
              <Button
                variant="ghost"
                size="sm"
                className={cn('w-full justify-start text-muted-foreground hover:text-foreground', {
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

        {/* Main Content - Changes based on current step */}
        <div className="flex-1 overflow-y-auto">
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
      </div>
    </div>
  );
};
