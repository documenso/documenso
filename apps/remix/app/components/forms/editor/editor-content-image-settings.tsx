import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import {
  APP_CONTENT_IMAGE_MIME_TYPES,
  APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT,
} from '@documenso/lib/constants/envelope-content';
import { formatFileSize, megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { FileImageIcon, ImageUpIcon, RefreshCwIcon, TrashIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { ContentImageUploadDialog } from '~/components/general/envelope-editor/content-image-upload-dialog';

type EditorContentImageSettingsProps = {
  formId: string;
  dataContentId?: string | null;
};

/**
 * Settings for image contents: the image itself.
 *
 * Uploads go through the shared upload dialog. This panel only offers the
 * ways to start one (drop, click, replace) and to remove the current image.
 * Geometry (page, position, size and rotation) is managed on the canvas.
 */
export const EditorContentImageSettings = ({ formId, dataContentId }: EditorContentImageSettingsProps) => {
  const { t } = useLingui();
  const { editorContents } = useCurrentEnvelopeEditor();
  const { contentImages } = useCurrentEnvelopeRender();

  const image = dataContentId ? contentImages.images.get(dataContentId) : undefined;
  const details = dataContentId ? contentImages.details.get(dataContentId) : undefined;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: Object.fromEntries(APP_CONTENT_IMAGE_MIME_TYPES.map((mimeType) => [mimeType, []])),
    multiple: false,
    maxSize: megabytesToBytes(APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT),
    // A dropped file goes straight to the dialog; a click opens the picker
    // through it instead of the dropzone's own input.
    noClick: true,
    onDrop: (acceptedFiles) => {
      const [file] = acceptedFiles;

      if (file) {
        void ContentImageUploadDialog.call({ formId, file });
      }
    },
  });

  if (dataContentId) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-border p-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
          <FileImageIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground text-xs">
            <Trans>Image</Trans>
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
            onClick={() => void ContentImageUploadDialog.call({ formId })}
          >
            <RefreshCwIcon className="h-4 w-4" strokeWidth={1.5} />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            title={t`Remove image`}
            onClick={() => editorContents.updateContentByFormId(formId, { dataContentId: null })}
          >
            <TrashIcon className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps({
        role: 'button',
        tabIndex: 0,
        onClick: () => void ContentImageUploadDialog.call({ formId }),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void ContentImageUploadDialog.call({ formId });
          }
        },
      })}
      className={cn(
        'mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed px-4 py-6 text-center transition-colors hover:border-primary/60',
        isDragActive && 'border-primary bg-primary/5',
      )}
    >
      <input {...getInputProps()} />
      <ImageUpIcon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-foreground text-sm">
        <Trans>Click to upload or drag and drop</Trans>
      </p>

      <p className="text-muted-foreground text-xs">
        <Trans>PNG, JPEG or WebP up to {APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT} MB</Trans>
      </p>
    </div>
  );
};
