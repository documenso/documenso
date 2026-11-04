import {
  ADMIN_RULE_SAMPLE_EVENTS,
  ADMIN_RULE_TRIGGER_FIELDS,
  type AdminRuleField,
} from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_ACTION_MAP } from '@documenso/lib/constants/admin-rules-translations';
import {
  type TAdminRuleContext,
  type TAdminRuleContextValue,
  type TAdminRuleDefinition,
  type TAdminRuleMode,
  type TAdminRuleTrigger,
  ZAdminRuleDefinitionSchema,
} from '@documenso/lib/types/admin-rules';
import {
  evaluateAdminRule,
  getAdminRuleDefinitionIssues,
  getAdminRuleGroupConditions,
  parseAdminRuleListValue,
} from '@documenso/lib/utils/admin-rules';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card } from '@documenso/ui/primitives/card';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { Trans, useLingui } from '@lingui/react/macro';
import { FlaskConicalIcon, RotateCcwIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { ADMIN_RULE_SELECT_TRIGGER_CLASS } from '~/components/general/admin-rules/admin-rule-styles';

export type AdminRuleTesterProps = {
  trigger: TAdminRuleTrigger;
  mode: TAdminRuleMode;
  definition: TAdminRuleDefinition;
};

/**
 * Evaluates the rule being edited against a sample event. Render it with `key={trigger}`, so a new
 * trigger starts from its own sample event.
 */
export const AdminRuleTester = ({ trigger, mode, definition }: AdminRuleTesterProps) => {
  const { t } = useLingui();

  const [event, setEvent] = useState<TAdminRuleContext>(() => ADMIN_RULE_SAMPLE_EVENTS[trigger]);

  // Number and list inputs keep their own text while typing, so a reset remounts them.
  const [sampleVersion, setSampleVersion] = useState(0);

  const outcome = getAdminRuleTesterOutcome({ trigger, mode, definition, event });

  const hasMatch = outcome === 'enforce' || outcome === 'monitor';

  const usedFieldKeys = useMemo(
    () => new Set(getAdminRuleGroupConditions(definition.when).map((condition) => condition.field)),
    [definition],
  );

  const matchedActions = hasMatch ? definition.actions : [];

  const fields = ADMIN_RULE_TRIGGER_FIELDS[trigger];

  const onValueChange = (key: string, value: TAdminRuleContextValue) => {
    setEvent((current) => ({ ...current, [key]: value }));
  };

  const onReset = () => {
    setEvent(ADMIN_RULE_SAMPLE_EVENTS[trigger]);
    setSampleVersion((version) => version + 1);
  };

  return (
    <Card className="overflow-hidden border shadow-none">
      <div className="flex items-start justify-between gap-2 px-[18px] pt-4 pb-3">
        <div className="flex items-start gap-2">
          <FlaskConicalIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-sm">
              <Trans>Test this rule</Trans>
            </h3>
            <p className="text-muted-foreground text-xs">
              <Trans>Edit the sample event and watch the result.</Trans>
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onReset}
          title={t`Reset sample event`}
        >
          <RotateCcwIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex max-h-[26rem] flex-col gap-2.5 overflow-y-auto px-[18px] pt-1 pb-4">
        {fields.map((fieldDefinition) => (
          <AdminRuleTesterField
            key={`${fieldDefinition.key}:${sampleVersion}`}
            fieldDefinition={fieldDefinition}
            value={event[fieldDefinition.key]}
            isUsed={usedFieldKeys.has(fieldDefinition.key)}
            onChange={(value) => onValueChange(fieldDefinition.key, value)}
          />
        ))}
      </div>

      <div
        className={cn('border-border border-t px-[18px] pt-3.5 pb-4', {
          'bg-muted/40': !hasMatch,
          'bg-primary/10': outcome === 'enforce',
          'bg-yellow-50 dark:bg-yellow-400/10': outcome === 'monitor',
        })}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', {
              'bg-muted-foreground/40': !hasMatch,
              'bg-primary': outcome === 'enforce',
              'bg-yellow-500': outcome === 'monitor',
            })}
          />
          <span className="font-semibold text-[13px]">
            {match(outcome)
              .with('disabled', () => <Trans>Rule disabled</Trans>)
              .with('incomplete', () => <Trans>Rule incomplete</Trans>)
              .with('no_match', () => <Trans>No match</Trans>)
              .with('enforce', 'monitor', () => <Trans>Conditions match</Trans>)
              .exhaustive()}
          </span>
        </div>

        <p className="mb-2 text-muted-foreground text-xs">
          {match(outcome)
            .with('disabled', () => <Trans>The rule is disabled, so it would not be evaluated at all.</Trans>)
            .with('incomplete', () => <Trans>Complete the rule to see a result.</Trans>)
            .with('no_match', () => <Trans>Nothing would happen for this event.</Trans>)
            .with('enforce', () => <Trans>These actions would run, in this order.</Trans>)
            .with('monitor', () => (
              <Trans>Monitor mode: the match would be logged but these actions would not run.</Trans>
            ))
            .exhaustive()}
        </p>

        {matchedActions.length > 0 && (
          <ol
            className={cn('flex list-decimal flex-col gap-1 pl-[18px] text-[13px]', {
              'opacity-60': outcome === 'monitor',
            })}
          >
            {matchedActions.map((action, index) => (
              <li key={index}>{t(ADMIN_RULE_ACTION_MAP[action.type])}</li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
};

type AdminRuleTesterFieldProps = {
  fieldDefinition: AdminRuleField;
  value: TAdminRuleContextValue | undefined;
  isUsed: boolean;
  onChange: (value: TAdminRuleContextValue) => void;
};

const AdminRuleTesterField = ({ fieldDefinition, value, isUsed, onChange }: AdminRuleTesterFieldProps) => {
  const inputId = `rule-tester-${fieldDefinition.key}`;

  return (
    <div className="grid gap-1">
      <Label
        htmlFor={inputId}
        className={cn('truncate font-medium font-mono text-[11px]', isUsed ? 'text-primary' : 'text-muted-foreground')}
        title={fieldDefinition.key}
      >
        {fieldDefinition.key}
      </Label>

      {fieldDefinition.type === 'boolean' && (
        <Switch id={inputId} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
      )}

      {fieldDefinition.type === 'enum' && (
        <Select value={typeof value === 'string' ? value : ''} onValueChange={(next) => onChange(next)}>
          <SelectTrigger id={inputId} className={cn('h-[34px] w-full text-[13px]', ADMIN_RULE_SELECT_TRIGGER_CLASS)}>
            <SelectValue />
          </SelectTrigger>

          <SelectContent position="popper">
            {(fieldDefinition.options ?? []).map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {fieldDefinition.type === 'number' && (
        <Input
          id={inputId}
          type="number"
          className="h-[34px] text-[13px]"
          defaultValue={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        />
      )}

      {fieldDefinition.type === 'string' && (
        <Input
          id={inputId}
          className="h-[34px] text-[13px]"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {fieldDefinition.type === 'string_list' && (
        <Input
          id={inputId}
          className="h-[34px] text-[13px]"
          placeholder="a.com, b.com"
          defaultValue={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(event) => onChange(parseAdminRuleListValue(event.target.value))}
        />
      )}
    </div>
  );
};

/**
 * Disabled rules are never evaluated, and a rule that can't be saved yet has no meaningful result:
 * an empty `contains` value, for example, matches every event.
 */
const getAdminRuleTesterOutcome = ({
  trigger,
  mode,
  definition,
  event,
}: GetAdminRuleTesterOutcomeOptions): AdminRuleTesterOutcome => {
  if (mode === 'DISABLED') {
    return 'disabled';
  }

  const isComplete =
    ZAdminRuleDefinitionSchema.safeParse(definition).success &&
    getAdminRuleDefinitionIssues(trigger, definition).length === 0;

  if (!isComplete) {
    return 'incomplete';
  }

  if (!evaluateAdminRule(definition, event)) {
    return 'no_match';
  }

  return mode === 'ENFORCE' ? 'enforce' : 'monitor';
};

type AdminRuleTesterOutcome = 'disabled' | 'incomplete' | 'no_match' | 'enforce' | 'monitor';

type GetAdminRuleTesterOutcomeOptions = {
  trigger: TAdminRuleTrigger;
  mode: TAdminRuleMode;
  definition: TAdminRuleDefinition;
  event: TAdminRuleContext;
};
