import { ADMIN_TAG_TYPE_MAP } from '@documenso/lib/constants/admin-tags-translations';
import type { TAdminTagType } from '@documenso/lib/types/admin-tags';
import { Badge, type BadgeProps } from '@documenso/ui/primitives/badge';
import { useLingui } from '@lingui/react/macro';
import { FlagIcon, type LucideIcon, StickyNoteIcon } from 'lucide-react';

export type AdminTagTypeBadgeProps = {
  type: TAdminTagType;
};

export const AdminTagTypeBadge = ({ type }: AdminTagTypeBadgeProps) => {
  const { t } = useLingui();

  const { variant, Icon } = ADMIN_TAG_TYPE_BADGE_CONFIG[type];

  return (
    <Badge variant={variant} size="small" className="gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" />
      {t(ADMIN_TAG_TYPE_MAP[type])}
    </Badge>
  );
};

const ADMIN_TAG_TYPE_BADGE_CONFIG = {
  note: {
    variant: 'neutral',
    Icon: StickyNoteIcon,
  },
  flagged_for_review: {
    variant: 'warning',
    Icon: FlagIcon,
  },
} as const satisfies Record<TAdminTagType, { variant: BadgeProps['variant']; Icon: LucideIcon }>;
