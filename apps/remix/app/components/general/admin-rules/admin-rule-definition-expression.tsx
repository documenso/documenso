import { ADMIN_RULE_ACTION_MAP, ADMIN_RULE_OPERATOR_MAP } from '@documenso/lib/constants/admin-rules-translations';
import type {
  TAdminRuleCondition,
  TAdminRuleConditionGroup,
  TAdminRuleDefinition,
} from '@documenso/lib/types/admin-rules';
import { formatAdminRuleConditionExpression } from '@documenso/lib/utils/admin-rules';
import { cn } from '@documenso/ui/lib/utils';
import { Trans, useLingui } from '@lingui/react/macro';
import { Fragment, type ReactNode } from 'react';

export type AdminRuleDefinitionExpressionProps = {
  definition: TAdminRuleDefinition;
  className?: string;
};

/**
 * Readable one-line summary of a rule, e.g.
 * `sender.plan is "free" AND (envelope.title contains "invoice" OR …) → Block the event`.
 * Nested groups are bracketed so the expression reads the way it is evaluated.
 */
export const AdminRuleDefinitionExpression = ({ definition, className }: AdminRuleDefinitionExpressionProps) => {
  const { t } = useLingui();

  const formatCondition = (condition: TAdminRuleCondition) =>
    formatAdminRuleConditionExpression(condition, t(ADMIN_RULE_OPERATOR_MAP[condition.operator]));

  const renderGroup = (group: TAdminRuleConditionGroup, isNested: boolean): ReactNode => {
    const joiner = group.match === 'all' ? 'AND' : 'OR';

    const parts = group.children.map((child, index) => (
      <Fragment key={index}>
        {index > 0 && <span className="text-muted-foreground"> {joiner} </span>}
        {child.type === 'group' ? renderGroup(child, true) : formatCondition(child)}
      </Fragment>
    ));

    // Brackets only change the meaning when a nested group joins more than one condition.
    if (!isNested || group.children.length < 2) {
      return parts;
    }

    return (
      <>
        <span className="text-muted-foreground">(</span>
        {parts}
        <span className="text-muted-foreground">)</span>
      </>
    );
  };

  return (
    <div
      className={cn(
        'rounded-md bg-muted/60 px-3 py-2.5 font-mono text-foreground text-xs leading-relaxed [overflow-wrap:anywhere]',
        className,
      )}
    >
      {renderGroup(definition.when, false)}

      <span className="text-muted-foreground"> → </span>

      {definition.actions.length === 0 ? (
        <span className="text-muted-foreground italic">
          <Trans>no actions</Trans>
        </span>
      ) : (
        definition.actions.map((action, index) => (
          <Fragment key={index}>
            {index > 0 && <span className="text-muted-foreground">, </span>}
            {t(ADMIN_RULE_ACTION_MAP[action.type])}
          </Fragment>
        ))
      )}
    </div>
  );
};
