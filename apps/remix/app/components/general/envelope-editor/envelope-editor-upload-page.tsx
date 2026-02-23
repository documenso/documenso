import { useMemo, useState } from 'react';

import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { msg, plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { FileWarningIcon, GripVerticalIcon, Loader2 } from 'lucide-react';
import { X } from 'lucide-react';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import {
  useCurrentEnvelopeEditor,
  useDebounceFunction,
} from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { nanoid } from '@documenso/lib/universal/id';
import { PRESIGNED_ENVELOPE_ITEM_ID_PREFIX } from '@documenso/lib/utils/embed-config';
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
  const { maximumEnvelopeItemCount, remaining } = useLimits();
  const { toast } = useToast();

  const { envelope, setLocalEnvelope, editorFields, editorConfig, isEmbedded, navigateToStep } =
    useCurrentEnvelopeEditor();

  const { envelopeItems: uploadConfig } = editorConfig;

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
    const newUploadingFiles: (LocalFile & {
      file: File;
      data: TEditorEnvelope['envelopeItems'][number]['data'] | null;
    })[] = await Promise.all(
      files.map(async (file) => {
        return {
          id: nanoid(),
          envelopeItemId: isEmbedded ? `${PRESIGNED_ENVELOPE_ITEM_ID_PREFIX}${nanoid()}` : null,
          title: file.name,
          file,
          isUploading: isEmbedded ? false : true,
          // Clone the buffer so it can be read multiple times (File.arrayBuffer() consumes the stream once)
          data: isEmbedded ? new Uint8Array((await file.arrayBuffer()).slice(0)) : null,
          isError: false,
        };
      }),
    );

    setLocalFiles((prev) => [...prev, ...newUploadingFiles]);

    // Directly commit the files for embedded documents since those are not uploaded
    // until the end of the embedded flow.
    if (isEmbedded) {
      setLocalEnvelope({
        envelopeItems: [
          ...envelope.envelopeItems,
          ...newUploadingFiles.map((file) => ({
            id: file.envelopeItemId!,
            title: file.title,
            order: envelope.envelopeItems.length + 1,
            envelopeId: envelope.id,
            data: file.data!,
          })),
        ],
      });

      return;
    }

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
    setLocalFiles((prev) =>
      prev.filter((uploadingFile) => uploadingFile.envelopeItemId !== envelopeItemId),
    );

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
    if (isEmbedded) {
      const nextEnvelopeItems = files
        .filter((item) => item.envelopeItemId)
        .map((item, index) => {
          const originalEnvelopeItem = envelope.envelopeItems.find(
            (envelopeItem) => envelopeItem.id === item.envelopeItemId,
          );

          return {
            id: item.envelopeItemId || '',
            title: item.title,
            order: index + 1,
            envelopeId: envelope.id,
            data: originalEnvelopeItem?.data,
          };
        });

      setLocalEnvelope({
        envelopeItems: nextEnvelopeItems,
      });

      return;
    }

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
      return msg({
        message: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
      });
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
        title: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
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
          {uploadConfig?.allowUpload && (
            <DocumentDropzone
              data-testid="envelope-item-dropzone"
              onDrop={onFileDrop}
              allowMultiple
              className="pb-4 pt-6"
              disabled={dropzoneDisabledMessage !== null}
              disabledMessage={dropzoneDisabledMessage || undefined}
              disabledHeading={msg`Upload disabled`}
              maxFiles={maximumEnvelopeItemCount - localFiles.length}
              onDropRejected={onFileDropRejected}
            />
          )}

          {/* Uploaded Files List */}
          <div className="mt-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="files">
                {(provided) => (
                  <div
                    data-testid="envelope-items-list"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {localFiles.map((localFile, index) => (
                      <Draggable
                        key={localFile.id}
                        isDragDisabled={
                          isCreatingEnvelopeItems ||
                          !canItemsBeModified ||
                          !uploadConfig?.allowConfigureOrder
                        }
                        draggableId={localFile.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            data-testid={`envelope-item-row-${localFile.id}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={provided.draggableProps.style}
                            className={`flex items-center justify-between rounded-lg bg-accent/50 p-3 transition-shadow ${
                              snapshot.isDragging ? 'shadow-md' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              {uploadConfig?.allowConfigureOrder && (
                                <div
                                  {...provided.dragHandleProps}
                                  data-testid={`envelope-item-drag-handle-${localFile.id}`}
                                  className="cursor-grab active:cursor-grabbing"
                                >
                                  <GripVerticalIcon className="h-5 w-5 flex-shrink-0 opacity-40" />
                                </div>
                              )}

                              <div>
                                {localFile.envelopeItemId !== null ? (
                                  <EnvelopeItemTitleInput
                                    disabled={
                                      envelope.status !== DocumentStatus.DRAFT ||
                                      !uploadConfig?.allowConfigureTitle
                                    }
                                    value={localFile.title}
                                    dataTestId={`envelope-item-title-input-${localFile.id}`}
                                    placeholder={t`Document Title`}
                                    onChange={(title) => {
                                      onEnvelopeItemTitleChange(localFile.envelopeItemId!, title);
                                    }}
                                  />
                                ) : (
                                  <p className="text-sm font-medium">{localFile.title}</p>
                                )}

                                <div className="text-xs text-muted-foreground">
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
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}

                              {localFile.isError && (
                                <div className="flex h-6 w-10 items-center justify-center">
                                  <FileWarningIcon className="h-4 w-4 text-destructive" />
                                </div>
                              )}

                              {!localFile.isUploading &&
                                localFile.envelopeItemId &&
                                uploadConfig?.allowDelete &&
                                (isEmbedded ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`envelope-item-remove-button-${localFile.id}`}
                                    onClick={() => onFileDelete(localFile.envelopeItemId!)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <EnvelopeItemDeleteDialog
                                    canItemBeDeleted={canItemsBeModified}
                                    envelopeId={envelope.id}
                                    envelopeItemId={localFile.envelopeItemId}
                                    envelopeItemTitle={localFile.title}
                                    onDelete={onFileDelete}
                                    trigger={
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        data-testid={`envelope-item-remove-button-${localFile.id}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                ))}
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
      {editorConfig.general.allowAddFieldsStep && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => void navigateToStep('addFields')}>
            <Trans>Add Fields</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};
