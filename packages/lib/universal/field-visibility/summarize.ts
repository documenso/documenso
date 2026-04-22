import type { TVisibilityBlock } from '../../types/field-meta';

export const summarizeUnmetRules = (
  block: TVisibilityBlock,
  stableIdToLabel: Map<string, string>,
): string => {
  const parts = block.rules
    .map((r) => {
      const label = stableIdToLabel.get(r.triggerFieldStableId) ?? 'a required field';
      switch (r.operator) {
        case 'equals':
          return `${label} was not "${r.value}"`;
        case 'notEquals':
          return `${label} was "${r.value}"`;
        case 'contains':
          return `${label} did not contain "${r.value}"`;
        case 'notContains':
          return `${label} contained "${r.value}"`;
        case 'isEmpty':
          return `${label} was not empty`;
        case 'isNotEmpty':
          return `${label} was empty`;
        default:
          return '';
      }
    })
    .filter(Boolean);

  const join = block.match === 'all' ? ' and ' : ' or ';
  return parts.join(join);
};
