import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { APP_CONTENT_IMAGE_MIME_TYPES, APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { EnvelopeContentType } from '@documenso/lib/types/envelope-content-meta';
import { resolveAttachedImageBox } from '@documenso/lib/universal/content-renderer/content-image-box';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { putImageFile } from '@documenso/lib/universal/upload/put-file';
import { useCallback } from 'react';

/**
 * Attach uploaded images to image contents.
 *
 * Attaching uploads the file, seeds the decoded image so it renders at once,
 * sizes the content's box to the image and links the data content. The link
 * is persisted by the regular autosave.
 */
export const useAttachContentImage = () => {
  const { editorContents, editorConfig } = useCurrentEnvelopeEditor();
  const { contentImages, pageSizes } = useCurrentEnvelopeRender();

  // The upload takes a while, so the content is re-read once it resolves in
  // case it was moved or resized in the meantime.
  const editorContentsRef = useLatestRef(editorContents);

  const attachContentImage = useCallback(
    async (formId: string, file: File) => {
      validateContentImageFile(file);

      const uploaded = await putImageFile(file, { presignToken: editorConfig.embedded?.presignToken });

      const content = editorContentsRef.current.getContentByFormId(formId);

      if (!content) {
        return;
      }

      const { contentMeta } = content;

      if (contentMeta.type !== EnvelopeContentType.IMAGE) {
        return;
      }

      // Decode the local file at the size the server normalized it to, so the
      // preview matches what the route would serve without another request.
      const image = await createImageBitmap(file, {
        imageOrientation: 'from-image',
        resizeWidth: uploaded.metadata.width,
        resizeHeight: uploaded.metadata.height,
        resizeQuality: 'high',
      }).catch((error: unknown) => {
        console.error('Failed to decode the uploaded image for preview', error);

        return null;
      });

      if (image) {
        contentImages.seed(uploaded.id, image, {
          fileName: uploaded.metadata.fileName,
          fileSize: uploaded.metadata.fileSize,
        });
      }

      const page = pageSizes.get(content.envelopeItemId, contentMeta.page ?? 1);

      const box = page
        ? resolveAttachedImageBox({
            image: uploaded.metadata,
            page,
            box: {
              positionX: contentMeta.positionX ?? 0,
              positionY: contentMeta.positionY ?? 0,
              width: contentMeta.width ?? 0,
              height: contentMeta.height ?? 0,
            },
          })
        : null;

      editorContentsRef.current.updateContentByFormId(formId, {
        dataContentId: uploaded.id,
        contentMeta: box ? { ...contentMeta, ...box } : contentMeta,
      });
    },
    [editorConfig.embedded?.presignToken, contentImages, pageSizes],
  );

  const removeContentImage = useCallback((formId: string) => {
    editorContentsRef.current.updateContentByFormId(formId, {
      dataContentId: null,
    });
  }, []);

  return {
    attachContentImage,
    removeContentImage,
  };
};

/**
 * Reject files the server would reject before uploading them, so the native
 * file picker path gets the same feedback as the drop zone.
 */
const validateContentImageFile = (file: File) => {
  if (file.size > megabytesToBytes(APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT)) {
    throw new AppError('FILE_TOO_LARGE');
  }

  if (!APP_CONTENT_IMAGE_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
    throw new AppError('INVALID_IMAGE_FILE');
  }
};
