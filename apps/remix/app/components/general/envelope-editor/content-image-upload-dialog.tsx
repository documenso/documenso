import { decodeLocalContentImage } from '@documenso/lib/client-only/load-content-image';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import {
  APP_CONTENT_IMAGE_MIME_TYPES,
  APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT,
} from '@documenso/lib/constants/envelope-content';
import { AppError } from '@documenso/lib/errors/app-error';
import { EnvelopeContentType } from '@documenso/lib/types/envelope-content-meta';
import { resolveAttachedImageBox } from '@documenso/lib/universal/content-renderer/content-image-box';
import { nanoid } from '@documenso/lib/universal/id';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { PRESIGNED_DATA_CONTENT_ID_PREFIX } from '@documenso/lib/utils/embed-config';
import type { Size } from '@documenso/lib/utils/geometry';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter } from '@documenso/ui/primitives/dialog';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createCallable } from 'react-call';
import { match } from 'ts-pattern';

/**
 * The DOM id of the dialog's file input, so the e2e suite can find it.
 */
export const getContentImageInputId = (formId: string) => `content-image-input-${formId}`;

type ContentImageUploadDialogProps = {
  formId: string;

  /**
   * A file to upload straight away, e.g. one dropped onto the settings
   * panel. Without it the file picker is opened first.
   */
  file?: File;
};

type UploadStatus = 'picking' | 'uploading' | 'invalid-image' | 'too-large' | 'failed';

/**
 * Why the server would reject the file, if it would, so the user finds out
 * before it is uploaded. Applies to dropped and picked files alike.
 */
const getRejectionReason = (file: File): 'too-large' | 'invalid-image' | null => {
  if (file.size > megabytesToBytes(APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT)) {
    return 'too-large';
  }

  if (!APP_CONTENT_IMAGE_MIME_TYPES.some((accepted) => accepted === file.type)) {
    return 'invalid-image';
  }

  return null;
};

/**
 * Attach an image to an image content.
 *
 * Blocks the editor from the moment it is opened until the upload settles,
 * so there is only ever one upload in flight. Pending autosaves are flushed
 * before uploading, so the content always has a server id by then.
 *
 * Invoke with `ContentImageUploadDialog.call({ formId })`; `Root` must be
 * mounted inside the envelope editor and render providers.
 */
export const ContentImageUploadDialog = createCallable<ContentImageUploadDialogProps, void>(
  ({ call, formId, file: droppedFile }) => {
    const { t } = useLingui();
    const { editorContents, flushAutosave, envelope, isEmbedded } = useCurrentEnvelopeEditor();
    const { contentImages, pageSizes } = useCurrentEnvelopeRender();

    const { mutateAsync: uploadImage } = trpc.envelope.content.uploadImage.useMutation();

    const inputRef = useRef<HTMLInputElement>(null);

    const [status, setStatus] = useState<UploadStatus>(() => {
      if (!droppedFile) {
        return 'picking';
      }

      return getRejectionReason(droppedFile) ?? 'uploading';
    });

    /**
     * Point the content at its new image, fitting its box to the image.
     *
     * `data` is the file of an image which has not been uploaded yet.
     */
    const attachImage = (dataContentId: string, image: Size, data?: File) => {
      // Re-read in case the content moved while the image was on its way.
      const latest = editorContents.getContentByFormId(formId);

      if (!latest || latest.contentMeta.type !== EnvelopeContentType.IMAGE) {
        return;
      }

      const { contentMeta } = latest;
      const page = pageSizes.get(latest.envelopeItemId, contentMeta.page);

      const box = page
        ? resolveAttachedImageBox({
            image,
            page,
            box: {
              positionX: contentMeta.positionX,
              positionY: contentMeta.positionY,
              width: contentMeta.width,
              height: contentMeta.height,
            },
          })
        : null;

      editorContents.updateContentByFormId(formId, {
        dataContentId,
        data,
        contentMeta: box ? { ...contentMeta, ...box } : contentMeta,
      });
    };

    const uploadToServer = async (file: File) => {
      // The content must exist on the server before an image can be
      // attached to it.
      await flushAutosave();

      const content = editorContents.getContentByFormId(formId);

      if (!content?.id || content.contentMeta.type !== EnvelopeContentType.IMAGE) {
        throw new AppError('CONTENT_NOT_PERSISTED');
      }

      const formData = new FormData();

      formData.append('payload', JSON.stringify({ envelopeId: envelope.id, envelopeContentId: content.id }));
      formData.append('file', file);

      const { dataContent } = await uploadImage(formData);

      // Decode the local file at the size the server normalized it to, so
      // the preview matches what the route would serve.
      const image = await createImageBitmap(file, {
        resizeWidth: dataContent.metadata.width,
        resizeHeight: dataContent.metadata.height,
        resizeQuality: 'high',
      }).catch(() => null);

      if (image) {
        contentImages.setImage(dataContent.id, image, {
          fileSize: dataContent.metadata.fileSize,
        });
      }

      attachImage(dataContent.id, dataContent.metadata);
    };

    const upload = async (file: File) => {
      setStatus('uploading');

      try {
        if (isEmbedded) {
          // Decoded the way the server will store it, which also rejects what
          // the server would, since it only sees the image once the envelope is
          // saved.
          const { image, details } = await decodeLocalContentImage(file);

          const dataContentId = `${PRESIGNED_DATA_CONTENT_ID_PREFIX}${nanoid()}`;

          contentImages.setImage(dataContentId, image, details);

          attachImage(dataContentId, image, file);
        } else {
          await uploadToServer(file);
        }

        call.end();
      } catch (err) {
        const error = AppError.parseError(err);

        setStatus(
          match(error.code)
            .with('INVALID_IMAGE_FILE', (): UploadStatus => 'invalid-image')
            .with('FILE_TOO_LARGE', (): UploadStatus => 'too-large')
            .otherwise((): UploadStatus => 'failed'),
        );
      }
    };

    // Dismissing the picker without choosing closes the dialog too. Browsers
    // fire `cancel` on the input for this, but React does not expose it as a
    // prop, so it is attached natively.
    useEffect(() => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      const onCancel = () => call.end();

      input.addEventListener('cancel', onCancel);

      return () => input.removeEventListener('cancel', onCancel);
    }, [call]);

    // Start immediately: upload the dropped file, or open the picker so the
    // user does not have to click twice. A dropped file the server would
    // reject opens on the reason instead.
    const hasStartedRef = useRef(false);

    useEffect(() => {
      if (hasStartedRef.current) {
        return;
      }

      hasStartedRef.current = true;

      if (!droppedFile) {
        inputRef.current?.click();
        return;
      }

      if (!getRejectionReason(droppedFile)) {
        void upload(droppedFile);
      }
    }, []);

    const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      // Allow the same file to be picked again after a failure.
      event.target.value = '';

      if (!file) {
        return;
      }

      const rejectionReason = getRejectionReason(file);

      if (rejectionReason) {
        setStatus(rejectionReason);
        return;
      }

      void upload(file);
    };

    // Clicked directly rather than via state, since the status may already
    // be `picking` and a state change alone would not reopen the picker.
    const reopenPicker = () => {
      setStatus('picking');
      inputRef.current?.click();
    };

    const isBusy = status === 'uploading';

    return (
      <>
        <input
          ref={inputRef}
          id={getContentImageInputId(formId)}
          type="file"
          accept={APP_CONTENT_IMAGE_MIME_TYPES.join(',')}
          className="hidden"
          onChange={onFilePicked}
        />

        <Dialog open={true} onOpenChange={(open) => !open && !isBusy && call.end()}>
          <DialogContent
            className={cn('max-w-xs', {
              hidden: status === 'picking',
            })}
            hideClose
            onPointerDownOutside={(event) => isBusy && event.preventDefault()}
            onEscapeKeyDown={(event) => isBusy && event.preventDefault()}
          >
            {match(status)
              .with('picking', () => null) // Only show the overlay since the actual browser uploader should be shown.
              .with('uploading', () => (
                <div
                  className="flex flex-col items-center justify-center gap-2 py-4"
                  data-testid="content-image-uploading"
                >
                  <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
                  <DialogDescription>
                    <Trans>Uploading Image</Trans>
                  </DialogDescription>
                </div>
              ))
              .with('invalid-image', () => (
                <DialogDescription className="text-destructive">
                  <Trans>This image could not be read. Use a PNG, JPEG or WebP file.</Trans>
                </DialogDescription>
              ))
              .with('too-large', () => (
                <DialogDescription className="text-destructive">
                  <Trans>This image is larger than {APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT} MB.</Trans>
                </DialogDescription>
              ))
              .with('failed', () => (
                <DialogDescription className="text-destructive">
                  <Trans>The image could not be uploaded. Please try again.</Trans>
                </DialogDescription>
              ))
              .exhaustive()}

            {!isBusy && (
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => call.end()}>
                  <Trans>Close</Trans>
                </Button>

                <Button type="button" onClick={reopenPicker}>
                  {status === 'picking' ? t`Choose image` : t`Try again`}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
