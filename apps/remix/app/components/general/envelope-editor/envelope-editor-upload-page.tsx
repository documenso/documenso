import { useMemo, useState } from 'react';

import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { FileWarningIcon, GripVerticalIcon, Loader2 } from 'lucide-react';
import { X } from 'lucide-react';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';
import { Link } from 'react-router';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import {
  useCurrentEnvelopeEditor,
  useDebounceFunction,
} from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { nanoid } from '@documenso/lib/universal/id';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopeItemsPayload } from '@documenso/trpc/server/envelope-router/create-envelope-items.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EnvelopeItemDeleteDialog } from '~/components/dialogs/envelope-item-delete-dialog';

import { EnvelopeEditorRecipientForm } from './envelope-editor-recipient-form';
import { EnvelopeItemTitleInput } from './envelope-editor-title-input';

type LocalFile = {
  id: string;
  title: string;
  envelopeItemId: string | null;
  isUploading: boolean;
  isError: boolean;
};

export const EnvelopeEditorUploadPage = () => {
  const organisation = useCurrentOrganisation();

  const { t } = useLingui();
  const { envelope, setLocalEnvelope, relativePath, editorFields } = useCurrentEnvelopeEditor();
  const { maximumEnvelopeItemCount, remaining } = useLimits();
  const { toast } = useToast();

  const [localFiles, setLocalFiles] = useState<LocalFile[]>(
    envelope.envelopeItems
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        title: item.title,
        envelopeItemId: item.id,
        isUploading: false,
        isError: false,
      })),
  );

  const { mutateAsync: createEnvelopeItems, isPending: isCreatingEnvelopeItems } =
    trpc.envelope.item.createMany.useMutation({
      onSuccess: ({ data }) => {
        const createdEnvelopes = data.filter(
          (item) => !envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === item.id),
        );

        setLocalEnvelope({
          envelopeItems: [...envelope.envelopeItems, ...createdEnvelopes],
        });
      },
    });

  const { mutateAsync: updateEnvelopeItems } = trpc.envelope.item.updateMany.useMutation({
    onSuccess: ({ data }) => {
      setLocalEnvelope({
        envelopeItems: envelope.envelopeItems.map((originalItem) => {
          const updatedItem = data.find((item) => item.id === originalItem.id);

          if (updatedItem) {
            return {
              ...originalItem,
              ...updatedItem,
            };
          }

          return originalItem;
        }),
      });
    },
  });

  const canItemsBeModified = useMemo(
    () => canEnvelopeItemsBeModified(envelope, envelope.recipients),
    [envelope, envelope.recipients],
  );

  const onFileDrop = async (files: File[]) => {
    const newUploadingFiles: (LocalFile & { file: File })[] = files.map((file) => ({
      id: nanoid(),
      envelopeItemId: null,
      title: file.name,
      file,
      isUploading: true,
      isError: false,
    }));

    setLocalFiles((prev) => [...prev, ...newUploadingFiles]);

    const payload = {
      envelopeId: envelope.id,
    } satisfies TCreateEnvelopeItemsPayload;

    const formData = new FormData();

    formData.append('payload', JSON.stringify(payload));

    for (const file of files) {
      formData.append('files', file);
    }

    const { data } = await createEnvelopeItems(formData).catch((error) => {
      console.error(error);

      // Set error state on files in batch upload.
      setLocalFiles((prev) =>
        prev.map((uploadingFile) =>
          uploadingFile.id === newUploadingFiles.find((file) => file.id === uploadingFile.id)?.id
            ? { ...uploadingFile, isError: true, isUploading: false }
            : uploadingFile,
        ),
      );

      throw error;
    });

    setLocalFiles((prev) => {
      const filteredFiles = prev.filter(
        (uploadingFile) =>
          uploadingFile.id !== newUploadingFiles.find((file) => file.id === uploadingFile.id)?.id,
      );

      return filteredFiles.concat(
        data.map((item) => ({
          id: item.id,
          envelopeItemId: item.id,
          title: item.title,
          isUploading: false,
          isError: false,
        })),
      );
    });
  };

  /**
   * Hide the envelope item from the list on deletion.
   */
  const onFileDelete = (envelopeItemId: string) => {
    setLocalFiles((prev) => prev.filter((uploadingFile) => uploadingFile.id !== envelopeItemId));

    const fieldsWithoutDeletedItem = envelope.fields.filter(
      (field) => field.envelopeItemId !== envelopeItemId,
    );

    setLocalEnvelope({
      envelopeItems: envelope.envelopeItems.filter((item) => item.id !== envelopeItemId),
      fields: envelope.fields.filter((field) => field.envelopeItemId !== envelopeItemId),
    });

    // Reset editor fields.
    editorFields.resetForm(fieldsWithoutDeletedItem);
  };

  /**
   * Handle drag end for reordering files.
   */
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(localFiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setLocalFiles(items);
    debouncedUpdateEnvelopeItems(items);
  };

  const debouncedUpdateEnvelopeItems = useDebounceFunction((files: LocalFile[]) => {
    void updateEnvelopeItems({
      envelopeId: envelope.id,
      data: files
        .filter((item) => item.envelopeItemId)
        .map((item, index) => ({
          envelopeItemId: item.envelopeItemId || '',
          order: index + 1,
          title: item.title,
        })),
    });
  }, 1000);

  const onEnvelopeItemTitleChange = (envelopeItemId: string, title: string) => {
    const newLocalFilesValue = localFiles.map((uploadingFile) =>
      uploadingFile.envelopeItemId === envelopeItemId ? { ...uploadingFile, title } : uploadingFile,
    );

    setLocalFiles(newLocalFilesValue);
    debouncedUpdateEnvelopeItems(newLocalFilesValue);
  };

  const dropzoneDisabledMessage = useMemo(() => {
    if (!canItemsBeModified) {
      return msg`Cannot upload items after the document has been sent`;
    }

    if (organisation.subscription && remaining.documents === 0) {
      return msg`Document upload disabled due to unpaid invoices`;
    }

    if (maximumEnvelopeItemCount <= localFiles.length) {
      return msg`You cannot upload more than ${maximumEnvelopeItemCount} items per envelope.`;
    }

    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFiles.length, maximumEnvelopeItemCount, remaining.documents]);

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: t`You cannot upload more than ${maximumEnvelopeItemCount} items per envelope.`,
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    toast({
      title: t`Upload failed`,
      description: t`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`,
      duration: 5000,
      variant: 'destructive',
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Card backdropBlur={false} className="border">
        <CardHeader className="pb-3">
          <CardTitle>
            <Trans>Documents</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Add and configure multiple documents</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <DocumentDropzone
            onDrop={onFileDrop}
            allowMultiple
            className="pb-4 pt-6"
            disabled={dropzoneDisabledMessage !== null}
            disabledMessage={dropzoneDisabledMessage || undefined}
            disabledHeading={msg`Upload disabled`}
            maxFiles={maximumEnvelopeItemCount - localFiles.length}
            onDropRejected={onFileDropRejected}
          />

          {/* Uploaded Files List */}
          <div className="mt-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="files">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {localFiles.map((localFile, index) => (
                      <Draggable
                        key={localFile.id}
                        isDragDisabled={isCreatingEnvelopeItems || !canItemsBeModified}
                        draggableId={localFile.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={provided.draggableProps.style}
                            className={`bg-accent/50 flex items-center justify-between rounded-lg p-3 transition-shadow ${
                              snapshot.isDragging ? 'shadow-md' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVerticalIcon className="h-5 w-5 flex-shrink-0 opacity-40" />
                              </div>

                              <div>
                                {localFile.envelopeItemId !== null ? (
                                  <EnvelopeItemTitleInput
                                    disabled={envelope.status !== DocumentStatus.DRAFT}
                                    value={localFile.title}
                                    placeholder={t`Document Title`}
                                    onChange={(title) => {
                                      onEnvelopeItemTitleChange(localFile.envelopeItemId!, title);
                                    }}
                                  />
                                ) : (
                                  <p className="text-sm font-medium">{localFile.title}</p>
                                )}

                                <div className="text-muted-foreground text-xs">
                                  {localFile.isUploading ? (
                                    <Trans>Uploading</Trans>
                                  ) : localFile.isError ? (
                                    <Trans>Something went wrong while uploading this file</Trans>
                                  ) : // <div className="text-xs text-gray-500">2.4 MB • 3 pages</div>
                                  null}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {localFile.isUploading && (
                                <div className="flex h-6 w-10 items-center justify-center">
                                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                </div>
                              )}

                              {localFile.isError && (
                                <div className="flex h-6 w-10 items-center justify-center">
                                  <FileWarningIcon className="text-destructive h-4 w-4" />
                                </div>
                              )}

                              {!localFile.isUploading && localFile.envelopeItemId && (
                                <EnvelopeItemDeleteDialog
                                  canItemBeDeleted={canItemsBeModified}
                                  envelopeId={envelope.id}
                                  envelopeItemId={localFile.envelopeItemId}
                                  envelopeItemTitle={localFile.title}
                                  onDelete={onFileDelete}
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </CardContent>
      </Card>

      {/* Recipients Section */}
      <EnvelopeEditorRecipientForm />

      <div className="flex justify-end">
        <Button asChild>
          <Link to={`${relativePath.editorPath}?step=addFields`}>
            <Trans>Add Fields</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
};
