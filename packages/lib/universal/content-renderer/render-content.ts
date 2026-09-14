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
 *
 * Contents are rendered as `content-group` named groups, mirroring the
 * `field-group` convention so reconciliation and the central visibility
 * handling in `usePageRenderer` apply to them automatically.
 *
 * Contents are display-only here, aside from hover feedback. Interactivity
 * (selection, dragging) is attached by the individual page renderers.
 */
export const renderContent = (content: ContentToRender, options: RenderContentOptions) => {
  const { pageLayer } = options;

  const isFirstRender = !pageLayer.findOne(`#${content.renderId}`);

  const contentGroup = match(content.contentMeta)
    .with({ type: EnvelopeContentType.TEXT }, (meta) => renderTextContentElement(content, meta, options))
    .with({ type: EnvelopeContentType.LINE }, (meta) => renderLineContentElement(content, meta, options))
    .with({ type: EnvelopeContentType.SHAPE }, (meta) => renderShapeContentElement(content, meta, options))
    .with({ type: EnvelopeContentType.HIGHLIGHT }, (meta) => renderHighlightContentElement(content, meta, options))
    .with({ type: EnvelopeContentType.IMAGE }, (meta) => renderImageContentElement(content, meta, options))
    .exhaustive();

  if (isFirstRender) {
    pageLayer.add(contentGroup);
  }

  return {
    contentGroup,
    isFirstRender,
  };
};
