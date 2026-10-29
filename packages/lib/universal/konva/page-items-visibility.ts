import type Konva from 'konva';
import { match } from 'ts-pattern';

import type { EnvelopePageItemsVisibility } from '../../types/envelope-page-items-visibility';

/**
 * Create a function which applies a fields or contents visibility to the
 * groups of a page.
 *
 * Note: The muted state only disables hit detection here. The muted *look*
 * (grey, read-only styling) is a render-time concern handled by the renderers
 * themselves, which map the muted visibility to the `readOnly` render color.
 */
export const createPageItemsVisibilityApplier = () => {
  // Whether hit detection is currently suppressed by the muted state. Hidden
  // does not touch hit detection, so a mute survives an intermediate hide and
  // must still be handed back once the groups become visible again.
  let isListeningMuted = false;

  return (groups: Konva.Node[], visibility: EnvelopePageItemsVisibility) => {
    for (const group of groups) {
      match(visibility)
        .with('hidden', () => {
          group.visible(false);
        })
        .with('muted', () => {
          group.visible(true);
          group.listening(false);
        })
        .with('visible', () => {
          group.visible(true);

          // Only restore hit detection when it was suppressed by the muted state.
          // Listening is otherwise owned by the renderers, e.g. the signing
          // renderer deliberately disables it for other recipients' fields.
          if (isListeningMuted) {
            group.listening(true);
          }
        })
        .exhaustive();
    }

    isListeningMuted = match(visibility)
      .with('muted', () => true)
      .with('visible', () => false)
      .with('hidden', () => isListeningMuted)
      .exhaustive();
  };
};
