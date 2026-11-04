import { ADMIN_RULE_MODES, ADMIN_RULE_TRIGGERS } from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_TRIGGER_MAP } from '@documenso/lib/constants/admin-rules-translations';
import { type TAdminRuleTrigger, ZAdminRuleTriggerSchema } from '@documenso/lib/types/admin-rules';
import { Trans, useLingui } from '@lingui/react/macro';
import { ZapIcon } from 'lucide-react';
import { parseAsStringEnum } from 'nuqs';

import { AdminRuleTriggerBadge } from '~/components/general/admin-rules/admin-rule-badges';
import { FilterPill } from '~/components/general/filter-pill';

export type AdminRuleTriggerFilterProps = {
  value: TAdminRuleTrigger | null;
  onChange: (value: TAdminRuleTrigger | null) => void;
};

export const AdminRuleTriggerFilter = ({ value, onChange }: AdminRuleTriggerFilterProps) => {
  const { t } = useLingui();

  return (
    <FilterPill
      icon={ZapIcon}
      label={<Trans>Trigger</Trans>}
      value={value}
      onChange={(nextValue) => onChange(ZAdminRuleTriggerSchema.nullable().catch(null).parse(nextValue))}
      selectedLabel={value && <AdminRuleTriggerBadge trigger={value} />}
      options={ADMIN_RULE_TRIGGERS.map((trigger) => ({
        value: trigger,
        label: t(ADMIN_RULE_TRIGGER_MAP[trigger]),
      }))}
    />
  );
};

/**
 * Shared nuqs parsers for the mode and trigger filters.
 *
 * Used by the rules list and the rule events page so both parse and serialise the params identically.
 */
export const adminRulesSearchParams = {
  mode: parseAsStringEnum(ADMIN_RULE_MODES),
  trigger: parseAsStringEnum(ADMIN_RULE_TRIGGERS),
};
