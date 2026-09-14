import type { EnvelopeContent } from '@prisma/client';
import type Konva from 'konva';
import { sortContentsForRender } from '../../utils/envelope-content';
import type { FieldRenderMode } from '../field-renderer/field-renderer';
import type { ContentImageMap } from './content-renderer';
import { renderContent } from './render-content';

type RenderStaticContentsOptions = {
  contents: Pick<EnvelopeContent, 'id' | 'metadata' | 'dataContentId' | 'zIndex'>[];
  pageLayer: Konva.Layer;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  mode: FieldRenderMode;

  /**
   * The loaded images of the image contents.
   */
  images?: ContentImageMap;
};

/**
 * Render contents as inert, display-only groups beneath everything else on
 * the layer, e.g. for signing and previews where contents cannot be edited.
 */
export const renderStaticContents = ({
  contents,
  pageLayer,
  pageWidth,
  pageHeight,
  scale,
  mode,
  images,
}: RenderStaticContentsOptions) => {
  // Rendered in stacking order so the last one is on top. The whole band is
  // then sent beneath the fields, in reverse so the order is preserved.
  const sortedContents = sortContentsForRender(contents);
  const contentGroups: Konva.Group[] = [];

  for (const content of sortedContents) {
    const { contentGroup } = renderContent(
      {
        renderId: content.id,
        contentMeta: content.metadata,
        dataContentId: content.dataContentId,
      },
      {
        pageLayer,
        pageWidth,
        pageHeight,
        scale,
        mode,
        editable: false,
        images,
      },
    );

    // Contents are part of the document, so they never intercept events.
    contentGroup.listening(false);
    contentGroups.push(contentGroup);
  }

  // Contents always sit beneath fields.
  for (const contentGroup of [...contentGroups].reverse()) {
    contentGroup.moveToBottom();
  }
};
