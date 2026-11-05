import type Konva from 'konva';
import { match } from 'ts-pattern';

import type { EnvelopePageItemsVisibility } from '../../types/envelope-page-items-visibility';

/**
 * Note: The muted state only disables hit detection here. The muted *look*
 * (grey, read-only styling) is handled by the renderers themselves.
 */
export const createPageItemsVisibilityApplier = () => {
  // Hidden does not touch hit detection, so a mute survives an intermediate
  // hide and must still be handed back once the groups become visible again.
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
