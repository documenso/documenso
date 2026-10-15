import { ADMIN_RULE_LIMITS } from '@documenso/lib/constants/admin-rules';
import type { TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import { getAdminRuleGroupConditions } from '@documenso/lib/utils/admin-rules';
import { Card } from '@documenso/ui/primitives/card';
import { Trans, useLingui } from '@lingui/react/macro';
import { useFormContext, useWatch } from 'react-hook-form';

import type { TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import { AdminRuleActionListFields } from '~/components/general/admin-rules/admin-rule-action-list-fields';
import { AdminRuleConditionGroupFields } from '~/components/general/admin-rules/admin-rule-condition-group-fields';
import { AdminRuleDefinitionExpression } from '~/components/general/admin-rules/admin-rule-definition-expression';
import { AdminRuleSectionChip } from '~/components/general/admin-rules/admin-rule-section-chip';

export type AdminRuleDefinitionFieldsProps = {
  trigger: TAdminRuleTrigger;
};

/**
 * The rule's logic: IF its conditions are met, THEN its actions run.
 */
export const AdminRuleDefinitionFields = ({ trigger }: AdminRuleDefinitionFieldsProps) => {
  const { t } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  // Computed, so the editor only re-renders when the limit is reached or left, not on every keystroke.
  const canAddCondition = useWatch({
    control: form.control,
    name: 'definition.when',
    compute: (when) => getAdminRuleGroupConditions(when).length < ADMIN_RULE_LIMITS.maxConditions,
  });

  return (
    <Card className="overflow-hidden border shadow-none">
      <div className="px-6 pt-5 pb-[18px]">
        <div className="mb-3.5 flex items-center gap-3">
          <AdminRuleSectionChip variant="primary">{t`If`}</AdminRuleSectionChip>
          <span className="text-muted-foreground text-sm">
            <Trans>these conditions are met</Trans>
          </span>
        </div>

        <AdminRuleConditionGroupFields
          path="definition.when"
          depth={1}
          trigger={trigger}
          canAddCondition={canAddCondition}
        />

        <AdminRuleDefinitionExpressionPreview />
      </div>

      <div className="border-border border-t bg-muted/40 px-6 pt-[18px] pb-5">
        <div className="mb-3 flex items-center gap-3">
          <AdminRuleSectionChip variant="dark">{t`Then`}</AdminRuleSectionChip>
          <span className="text-muted-foreground text-sm">
            <Trans>run these actions</Trans>
          </span>
        </div>

        <AdminRuleActionListFields trigger={trigger} />
      </div>
    </Card>
  );
};

/**
 * Watches the definition for the preview, so typing in the editor only re-renders the preview.
 */
const AdminRuleDefinitionExpressionPreview = () => {
  const form = useFormContext<TAdminRuleFormSchema>();

  const definition = useWatch({ control: form.control, name: 'definition' });

  return <AdminRuleDefinitionExpression definition={definition} className="mt-3.5" />;
};
