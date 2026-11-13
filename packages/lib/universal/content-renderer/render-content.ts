import { match } from 'ts-pattern';

import { EnvelopeContentType } from '../../types/envelope-content-meta';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import { renderHighlightContentElement } from './render-highlight-content';
import { renderImageContentElement } from './render-image-content';
import { renderLineContentElement } from './render-line-content';
import { renderShapeContentElement } from './render-shape-content';
import { renderTextContentElement } from './render-text-content';

/**
 * Render an envelope content onto a Konva page layer.
 */
export const renderContent = (content: ContentToRender, options: RenderContentOptions) => {
  const { pageLayer } = options;

  const isFirstRender = !pageLayer.findOne(`#${content.renderId}`);

  const contentGroup = match(content.contentMeta.type)
    .with(EnvelopeContentType.TEXT, () => renderTextContentElement(content, options))
    .with(EnvelopeContentType.LINE, () => renderLineContentElement(content, options))
    .with(EnvelopeContentType.SHAPE, () => renderShapeContentElement(content, options))
    .with(EnvelopeContentType.HIGHLIGHT, () => renderHighlightContentElement(content, options))
    .with(EnvelopeContentType.IMAGE, () => renderImageContentElement(content, options))
    .exhaustive();

  if (isFirstRender) {
    pageLayer.add(contentGroup);
  }

  return {
    contentGroup,
    isFirstRender,
  };
};
