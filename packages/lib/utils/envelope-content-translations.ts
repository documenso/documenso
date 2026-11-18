import type { I18n, MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { mapValues } from 'remeda';

import { EnvelopeContentShapeType, EnvelopeContentType } from '../types/envelope-content-meta';

// Note: Kept apart from the meta types and other content utils since those are
// loaded where the lingui macro is not transformed (e2e runner, seed scripts).

export const FRIENDLY_CONTENT_TYPE: Record<EnvelopeContentType, MessageDescriptor> = {
  [EnvelopeContentType.TEXT]: msg`Text`,
  [EnvelopeContentType.LINE]: msg`Line`,
  [EnvelopeContentType.SHAPE]: msg`Shape`,
  [EnvelopeContentType.HIGHLIGHT]: msg`Highlight`,
  [EnvelopeContentType.IMAGE]: msg`Image`,
};

export const FRIENDLY_CONTENT_SHAPE_TYPE: Record<EnvelopeContentShapeType, MessageDescriptor> = {
  [EnvelopeContentShapeType.RECTANGLE]: msg`Rectangle`,
};

export const getClientSideContentTranslations = ({ t }: I18n): Record<EnvelopeContentType, string> => {
  return mapValues(FRIENDLY_CONTENT_TYPE, (descriptor) => t(descriptor));
};
