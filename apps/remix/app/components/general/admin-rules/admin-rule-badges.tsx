import { ADMIN_RULE_MODE_MAP, ADMIN_RULE_TRIGGER_MAP } from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleMode, TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import { Badge } from '@documenso/ui/primitives/badge';
import { useLingui } from '@lingui/react/macro';
import { EyeIcon, PauseIcon, ShieldCheckIcon } from 'lucide-react';

type AdminRuleModeBadgeProps = {
  mode: TAdminRuleMode;
};

export const AdminRuleModeBadge = ({ mode }: AdminRuleModeBadgeProps) => {
  const { t } = useLingui();

  const { variant, Icon } = ADMIN_RULE_MODE_BADGE_CONFIG[mode];

  return (
    <Badge variant={variant} size="small" className="gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" />
      {t(ADMIN_RULE_MODE_MAP[mode])}
    </Badge>
  );
};

type AdminRuleTriggerBadgeProps = {
  trigger: TAdminRuleTrigger;
};

export const AdminRuleTriggerBadge = ({ trigger }: AdminRuleTriggerBadgeProps) => {
  const { t } = useLingui();

  return (
    <Badge variant="neutral" size="small" className="whitespace-nowrap">
      {t(ADMIN_RULE_TRIGGER_MAP[trigger])}
    </Badge>
  );
};

const ADMIN_RULE_MODE_BADGE_CONFIG = {
  ENFORCE: { variant: 'default', Icon: ShieldCheckIcon },
  MONITOR: { variant: 'secondary', Icon: EyeIcon },
  DISABLED: { variant: 'neutral', Icon: PauseIcon },
} as const;
