import type { MessageDescriptor } from '@lingui/core';
import type { LucideIcon } from 'lucide-react';

export type PromptItem = {
  id: string;
  label: string | MessageDescriptor;
  sublabel?: string;
  path?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  initials?: string;
  shortcut?: string;
  isChecked?: boolean;
};

export type PromptCategory = {
  id: string;
  label: MessageDescriptor;
  items: PromptItem[];
  /**
   * The number of actual results, excluding utility rows such as the
   * "View all results" link.
   */
  count: number;
  /**
   * The count shown on the category chip, or null to not show a chip at all.
   * Categories which only contain hardcoded page links have no chip.
   */
  chipCount: number | null;
  isCapped: boolean;
  /**
   * Global admin categories are marked with a globe icon to distinguish them
   * from the equally named personal categories.
   */
  isGlobal: boolean;
};
