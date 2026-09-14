import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { APP_CONTENT_IMAGE_MIME_TYPES, APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { formatFileSize, megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { FileImageIcon, ImageUpIcon, Loader2Icon, RefreshCwIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { match } from 'ts-pattern';
import { useAttachContentImage } from '~/components/general/envelope-editor/use-attach-content-image';

type ContentImageUploadError = 'invalid-image' | 'too-large' | 'failed';

/**
 * The DOM id of the file input for a content's image, so other surfaces
 * (e.g. the canvas action bar) can open the picker by clicking it.
 *
 * The input is always mounted while the content is selected, which is the
 * only time those surfaces offer the action.
 */
export const getContentImageInputId = (formId: string) => `content-image-input-${formId}`;

type EditorContentImageSettingsProps = {
  /**
   * The local content the image belongs to.
   */
  formId: string;

  /**
   * The data content of the image attached to the content, if any.
   */
  dataContentId: string | null;
};

/**
 * Settings for image contents: the image itself.
 *
 * Geometry (page, position, size and rotation) is managed on the canvas.
 */
export const EditorContentImageSettings = ({ formId, dataContentId }: EditorContentImageSettingsProps) => {
  const { t } = useLingui();
  const { contentImages } = useCurrentEnvelopeRender();
  const { attachContentImage, removeContentImage } = useAttachContentImage();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<ContentImageUploadError | null>(null);

  const image = dataContentId ? contentImages.images.get(dataContentId) : undefined;
  const details = dataContentId ? contentImages.details.get(dataContentId) : undefined;

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      await attachContentImage(formId, file);
    } catch (err) {
      const error = AppError.parseError(err);

      setUploadError(
        match(error.code)
          .with('INVALID_IMAGE_FILE', (): ContentImageUploadError => 'invalid-image')
          .with('FILE_TOO_LARGE', (): ContentImageUploadError => 'too-large')
          .otherwise((): ContentImageUploadError => 'failed'),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRejected = (rejections: FileRejection[]) => {
    const isTooLarge = rejections.some((rejection) =>
      rejection.errors.some((rejectionError) => rejectionError.code === 'file-too-large'),
    );

    setUploadError(isTooLarge ? 'too-large' : 'invalid-image');
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: Object.fromEntries(APP_CONTENT_IMAGE_MIME_TYPES.map((mimeType) => [mimeType, []])),
    multiple: false,
    disabled: isUploading,
    maxSize: megabytesToBytes(APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT),
    onDrop: (acceptedFiles) => {
      const [file] = acceptedFiles;

      if (file) {
        void handleUpload(file);
      }
    },
    onDropRejected: handleRejected,
  });

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* Always mounted so "Replace" and the canvas action bar can open the picker. */}
      <input {...getInputProps({ id: getContentImageInputId(formId) })} />

      {dataContentId && !isUploading ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
            <FileImageIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-xs" title={details?.fileName ?? undefined}>
              {details?.fileName ?? t`Image`}
            </p>

            <p className="truncate text-muted-foreground text-xs">
              {[details ? formatFileSize(details.fileSize) : null, image ? `${image.width} * ${image.height}` : null]
                .filter((part) => part !== null)
                .join(' · ')}
            </p>
          </div>

          <div className="flex shrink-0 flex-row gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              title={t`Replace image`}
              onClick={open}
            >
              <RefreshCwIcon className="h-4 w-4" strokeWidth={1.5} />
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              title={t`Remove image`}
              onClick={() => removeContentImage(formId)}
            >
              <TrashIcon className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed px-4 py-6 text-center transition-colors hover:border-primary/60',
            isDragActive && 'border-primary bg-primary/5',
            isUploading && 'cursor-default',
          )}
        >
          {isUploading ? (
            <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageUpIcon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          )}

          <p className="text-foreground text-sm">
            {isUploading ? <Trans>Uploading...</Trans> : <Trans>Click to upload or drag and drop</Trans>}
          </p>

          <p className="text-muted-foreground text-xs">
            <Trans>PNG, JPEG or WebP up to {APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT} MB</Trans>
          </p>
        </div>
      )}

      {uploadError && (
        <p className="text-destructive text-xs">
          {match(uploadError)
            .with('invalid-image', () => t`This image could not be read. Use a PNG, JPEG or WebP file.`)
            .with('too-large', () => t`This image is larger than ${APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT} MB.`)
            .with('failed', () => t`The image could not be uploaded. Please try again.`)
            .exhaustive()}
        </p>
      )}
    </div>
  );
};
