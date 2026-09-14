import Konva from 'konva';
import { describe, expect, it } from 'vitest';

import type { EnvelopePageItemsVisibility } from '../../types/envelope-page-items-visibility';
import { createPageItemsVisibilityApplier } from './page-items-visibility';

const createGroups = (count = 2) => Array.from({ length: count }, () => new Konva.Group({ name: 'field-group' }));

const applySequence = (groups: Konva.Group[], sequence: EnvelopePageItemsVisibility[]) => {
  const apply = createPageItemsVisibilityApplier();

  for (const visibility of sequence) {
    apply(groups, visibility);
  }
};

describe('createPageItemsVisibilityApplier', () => {
  it('hides and shows the groups', () => {
    const groups = createGroups();

    applySequence(groups, ['hidden']);
    expect(groups.map((group) => group.visible())).toEqual([false, false]);

    applySequence(groups, ['hidden', 'visible']);
    expect(groups.map((group) => group.visible())).toEqual([true, true]);
  });

  it('disables hit detection while muted and restores it when visible again', () => {
    const groups = createGroups();

    applySequence(groups, ['muted']);
    expect(groups.map((group) => group.listening())).toEqual([false, false]);

    applySequence(groups, ['muted', 'visible']);
    expect(groups.map((group) => group.listening())).toEqual([true, true]);
  });

  it('restores hit detection when a mute is followed by a hide before becoming visible', () => {
    const groups = createGroups();

    applySequence(groups, ['muted', 'hidden', 'visible']);

    expect(groups.map((group) => group.listening())).toEqual([true, true]);
  });

  it('leaves hit detection owned by the renderer alone when never muted', () => {
    const groups = createGroups();

    // E.g. the signing renderer disables hit detection for other recipients' fields.
    groups[0].listening(false);

    applySequence(groups, ['visible', 'hidden', 'visible']);

    expect(groups.map((group) => group.listening())).toEqual([false, true]);
  });
});
