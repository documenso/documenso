import { lazy } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentSigningOrder, SigningStatus } from '@prisma/client';
import { ChevronLeft, LucideEdit } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { Spinner } from '@documenso/ui/primitives/spinner';

import { TemplateBulkSendDialog } from '~/components/dialogs/template-bulk-send-dialog';
import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';
import { TemplateUseDialog } from '~/components/dialogs/template-use-dialog';
import { EnvelopeRendererFileSelector } from '~/components/general/envelope-editor/envelope-file-selector';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { TemplateDirectLinkBadge } from '~/components/general/template/template-direct-link-badge';
import { TemplatePageViewDocumentsTable } from '~/components/general/template/template-page-view-documents-table';
import { TemplatePageViewInformation } from '~/components/general/template/template-page-view-information';
import { TemplatePageViewRecentActivity } from '~/components/general/template/template-page-view-recent-activity';
import { TemplatePageViewRecipients } from '~/components/general/template/template-page-view-recipients';
import { TemplateType } from '~/components/general/template/template-type';
import { TemplatesTableActionDropdown } from '~/components/tables/templates-table-action-dropdown';
import { useCurrentTeam } from '~/providers/team';

import type { Route } from './+types/templates.$id._index';

const EnvelopeGenericPageRenderer = lazy(
  async () => import('~/components/general/envelope-editor/envelope-generic-page-renderer'),
);

export default function TemplatePage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { user } = useSession();
  const navigate = useNavigate();

  const team = useCurrentTeam();

  const {
    data: envelope,
    isLoading: isLoadingEnvelope,
    isError: isErrorEnvelope,
  } = trpc.envelope.get.useQuery({
    envelopeId: params.id,
  });

  if (isLoadingEnvelope) {
    return (
      <div className="flex w-screen flex-col items-center justify-center gap-2 py-64 text-foreground">
        <Spinner />
        <Trans>Loading</Trans>
      </div>
    );
  }

  if (isErrorEnvelope || !envelope) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Not found`,
            subHeading: msg`404 Not found`,
            message: msg`The template you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/t/${team.url}/templates`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  const documentRootPath = formatDocumentsPath(team.url);
  const templateRootPath = formatTemplatesPath(team.url);

  // Remap to fit the DocumentReadOnlyFields component.
  const readOnlyFields = envelope.fields.map((field) => {
    const recipient = envelope.recipients.find(
      (recipient) => recipient.id === field.recipientId,
    ) || {
      name: '',
      email: '',
      signingStatus: SigningStatus.NOT_SIGNED,
    };

    return {
      ...field,
      recipient,
      signature: null,
    };
  });

  const mockedDocumentMeta = envelope.documentMeta
    ? {
        ...envelope.documentMeta,
        signingOrder: envelope.documentMeta.signingOrder || DocumentSigningOrder.SEQUENTIAL,
        documentId: 0,
      }
    : undefined;

  const isMultiEnvelopeItem = envelope.envelopeItems.length > 1 && envelope.internalVersion === 2;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link to={templateRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Templates</Trans>
      </Link>

      <div className="flex flex-row justify-between truncate">
        <div>
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={envelope.title}
          >
            {envelope.title}
          </h1>

          <div className="mt-2.5 flex items-center">
            <TemplateType
              inheritColor
              className="text-muted-foreground"
              type={envelope.templateType}
            />

            {envelope.directLink?.token && (
              <TemplateDirectLinkBadge
                className="ml-4"
                token={envelope.directLink.token}
                enabled={envelope.directLink.enabled}
              />
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-row space-x-4 sm:mt-0 sm:self-end">
          <TemplateDirectLinkDialog
            templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
            directLink={envelope.directLink}
            recipients={envelope.recipients}
          />

          <TemplateBulkSendDialog
            templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
            recipients={envelope.recipients}
          />

          <Button className="w-full" asChild>
            <Link to={`${templateRootPath}/${envelope.id}/edit`}>
              <LucideEdit className="mr-1.5 h-3.5 w-3.5" />
              <Trans>Edit Template</Trans>
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid w-full grid-cols-12 gap-8">
        {envelope.internalVersion === 2 ? (
          <div className="relative col-span-12 lg:col-span-6 xl:col-span-7">
            <EnvelopeRenderProvider
              envelope={envelope}
              token={undefined}
              fields={envelope.fields}
              recipients={envelope.recipients}
              overrideSettings={{
                showRecipientTooltip: true,
              }}
            >
              {isMultiEnvelopeItem && (
                <EnvelopeRendererFileSelector fields={envelope.fields} className="mb-4 p-0" />
              )}

              <Card className="rounded-xl before:rounded-xl" gradient>
                <CardContent className="p-2">
                  <PDFViewerKonvaLazy
                    renderer="preview"
                    customPageRenderer={EnvelopeGenericPageRenderer}
                  />
                </CardContent>
              </Card>
            </EnvelopeRenderProvider>
          </div>
        ) : (
          <Card
            className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
            gradient
          >
            <CardContent className="p-2">
              <DocumentReadOnlyFields
                fields={readOnlyFields}
                showFieldStatus={false}
                showRecipientTooltip={true}
                showRecipientColors={true}
                recipientIds={envelope.recipients.map((recipient) => recipient.id)}
                documentMeta={mockedDocumentMeta}
              />

              <PDFViewerLazy
                envelopeItem={envelope.envelopeItems[0]}
                token={undefined}
                version="signed"
                key={envelope.envelopeItems[0].id}
              />
            </CardContent>
          </Card>
        )}

        <div
          className={cn('col-span-12 lg:col-span-6 xl:col-span-5', isMultiEnvelopeItem && 'mt-20')}
        >
          <div className="space-y-6">
            <section className="flex flex-col rounded-xl border border-border bg-widget pb-4 pt-6">
              <div className="flex flex-row items-center justify-between px-4">
                <h3 className="text-2xl font-semibold text-foreground">
                  <Trans>Template</Trans>
                </h3>

                <div>
                  <TemplatesTableActionDropdown
                    row={{
                      ...envelope,
                      id: mapSecondaryIdToTemplateId(envelope.secondaryId),
                      envelopeId: envelope.id,
                    }}
                    teamId={team?.id}
                    templateRootPath={templateRootPath}
                    onDelete={async () => navigate(templateRootPath)}
                  />
                </div>
              </div>

              <p className="mt-2 px-4 text-sm text-muted-foreground">
                <Trans>Manage and view template</Trans>
              </p>

              <div className="mt-4 border-t px-4 pt-4">
                <TemplateUseDialog
                  envelopeId={envelope.id}
                  templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
                  templateSigningOrder={envelope.documentMeta?.signingOrder}
                  recipients={envelope.recipients}
                  documentRootPath={documentRootPath}
                  trigger={
                    <Button className="w-full">
                      <Trans>Use</Trans>
                    </Button>
                  }
                />
              </div>
            </section>

            {/* Template information section. */}
            <TemplatePageViewInformation template={envelope} userId={user.id} />

            {/* Recipients section. */}
            <TemplatePageViewRecipients
              recipients={envelope.recipients}
              envelopeId={envelope.id}
              templateRootPath={templateRootPath}
            />

            {/* Recent activity section. */}
            <TemplatePageViewRecentActivity
              documentRootPath={documentRootPath}
              templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
            />
          </div>
        </div>
      </div>

      <div className="mt-16" id="documents">
        <h1 className="mb-4 text-2xl font-bold">
          <Trans>Documents created from template</Trans>
        </h1>

        <TemplatePageViewDocumentsTable
          templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
        />
      </div>
    </div>
  );
}
