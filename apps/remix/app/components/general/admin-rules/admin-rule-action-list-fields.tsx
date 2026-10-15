import {
  ADMIN_RULE_ACTIONS,
  type AdminRuleActionParamDefinition,
  getAdminRuleActionsForTrigger,
  getAdminRuleDefaultActionParams,
} from '@documenso/lib/constants/admin-rules';
import {
  ADMIN_RULE_ACTION_DESCRIPTION_MAP,
  ADMIN_RULE_ACTION_MAP,
  ADMIN_RULE_ACTION_PARAM_MAP,
} from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleActionType, TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, XIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import type { TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import { ADMIN_RULE_SELECT_TRIGGER_CLASS } from '~/components/general/admin-rules/admin-rule-styles';

export type AdminRuleActionListFieldsProps = {
  trigger: TAdminRuleTrigger;
};

export const AdminRuleActionListFields = ({ trigger }: AdminRuleActionListFieldsProps) => {
  const { t, i18n } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'definition.actions',
  });

  // Watched, because `fields` keeps the type each action had when it was added. Only the types are
  // computed, so typing in an action's parameters doesn't re-render the list.
  const actionTypes = useWatch({
    control: form.control,
    name: 'definition.actions',
    compute: (actions) => actions.map((action) => action.type),
  });

  const availableActions = getAdminRuleActionsForTrigger(trigger);

  // Disabling the user doesn't stop the event that triggered the rule.
  const isBlockRecommended =
    actionTypes.includes('disable_user') &&
    !actionTypes.includes('block_event') &&
    availableActions.includes('block_event');

  const listFieldError = form.getFieldState('definition.actions', form.formState).error;

  const listError = listFieldError?.root?.message ?? listFieldError?.message;

  const onAddAction = (type: TAdminRuleActionType) => {
    append({ type, params: getAdminRuleDefaultActionParams(type) });
  };

  return (
    <div>
      <div className="flex flex-col gap-2">
        {fields.map((item, index) => (
          <AdminRuleActionItemFields key={item.id} index={index} trigger={trigger} onRemove={() => remove(index)} />
        ))}
      </div>

      {isBlockRecommended && (
        <Alert variant="warning" padding="tight" className="mt-2" data-testid="admin-rule-block-recommendation">
          <AlertDescription className="text-[13px]">
            <Trans>
              Disabling the user doesn't stop the event that triggered the rule. We recommend also blocking the event.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      {listError && <p className="mt-2 font-medium text-destructive text-sm">{i18n._(listError)}</p>}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="mt-2.5 h-8 bg-background text-[13px]">
            <PlusIcon className="mr-1.5 -ml-1 h-3.5 w-3.5" />
            <Trans>Add action</Trans>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {availableActions.map((type) => (
            <DropdownMenuItem
              key={type}
              onSelect={() => onAddAction(type)}
              className="flex flex-col items-start whitespace-normal"
            >
              <span className="font-medium">{t(ADMIN_RULE_ACTION_MAP[type])}</span>
              <span className="min-w-0 text-muted-foreground text-xs">
                {t(ADMIN_RULE_ACTION_DESCRIPTION_MAP[type])}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

type AdminRuleActionItemFieldsProps = {
  index: number;
  trigger: TAdminRuleTrigger;
  onRemove: () => void;
};

const AdminRuleActionItemFields = ({ index, trigger, onRemove }: AdminRuleActionItemFieldsProps) => {
  const { t } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  const basePath = `definition.actions.${index}` as const;

  const type = useWatch({ control: form.control, name: `${basePath}.type` });

  const definition = ADMIN_RULE_ACTIONS[type];
  const availableActions = getAdminRuleActionsForTrigger(trigger);

  const onTypeChange = (nextType: TAdminRuleActionType) => {
    form.clearErrors(basePath);

    form.setValue(`${basePath}.type`, nextType, { shouldDirty: true });
    form.setValue(`${basePath}.params`, getAdminRuleDefaultActionParams(nextType), { shouldDirty: true });
  };

  return (
    <div className="@container">
      <div className="grid @lg:grid-cols-[1.5rem_minmax(10rem,1fr)_minmax(0,1.3fr)_2rem] grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-start gap-2">
        <span className="flex h-[38px] items-center justify-center font-semibold text-muted-foreground text-xs tabular-nums">
          {index + 1}
        </span>

        <FormField
          control={form.control}
          name={`${basePath}.type`}
          render={({ field }) => (
            <FormItem className="min-w-0 space-y-1">
              <FormLabel className="sr-only">
                <Trans>Action</Trans>
              </FormLabel>
              <Select value={field.value} onValueChange={(value) => onTypeChange(value as TAdminRuleActionType)}>
                <FormControl>
                  <SelectTrigger
                    className={cn('h-[38px] w-full bg-background text-[13px]', ADMIN_RULE_SELECT_TRIGGER_CLASS)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>

                <SelectContent position="popper">
                  {availableActions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(ADMIN_RULE_ACTION_MAP[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="@lg:col-span-1 col-span-2 @lg:col-start-3 col-start-2 flex min-w-0 flex-wrap gap-2">
          {definition.params.length === 0 ? (
            <p className="flex h-[38px] items-center text-[13px] text-muted-foreground">
              {t(ADMIN_RULE_ACTION_DESCRIPTION_MAP[type])}
            </p>
          ) : (
            definition.params.map((param) => (
              <AdminRuleActionParamField key={param.key} basePath={basePath} param={param} />
            ))
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="@lg:col-start-4 col-start-3 row-start-1 @lg:mt-[3px] h-8 w-8 p-0 text-muted-foreground"
          onClick={onRemove}
          title={t`Remove action`}
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">
            <Trans>Remove action</Trans>
          </span>
        </Button>
      </div>
    </div>
  );
};

type AdminRuleActionParamFieldProps = {
  basePath: `definition.actions.${number}`;
  param: AdminRuleActionParamDefinition;
};

const AdminRuleActionParamField = ({ basePath, param }: AdminRuleActionParamFieldProps) => {
  const { t } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  const label = t(ADMIN_RULE_ACTION_PARAM_MAP[param.key]);

  return (
    <FormField
      control={form.control}
      name={`${basePath}.params.${param.key}`}
      render={({ field }) => {
        if (param.kind === 'boolean') {
          return (
            <FormItem className="flex h-[38px] min-w-0 flex-1 basis-[7.5rem] items-center gap-2 space-y-0">
              <FormControl>
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal text-[13px]">{label}</FormLabel>
              <FormMessage />
            </FormItem>
          );
        }

        if (param.kind === 'select') {
          return (
            <FormItem className="min-w-0 flex-1 basis-[7.5rem] space-y-1">
              <FormLabel className="sr-only">{label}</FormLabel>
              <Select value={typeof field.value === 'string' ? field.value : ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger
                    className={cn('h-[38px] w-full bg-background text-[13px]', ADMIN_RULE_SELECT_TRIGGER_CLASS)}
                    title={label}
                  >
                    <SelectValue placeholder={label} />
                  </SelectTrigger>
                </FormControl>

                <SelectContent position="popper">
                  {(param.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          );
        }

        if (param.kind === 'number') {
          return (
            <FormItem className="min-w-0 flex-1 basis-[7.5rem] space-y-1">
              <FormLabel className="sr-only">{label}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={label}
                  title={label}
                  className="h-[38px] bg-background text-[13px]"
                  value={typeof field.value === 'number' ? field.value : ''}
                  onChange={(event) => {
                    const raw = event.target.value;

                    if (raw === '') {
                      field.onChange(0);
                      return;
                    }

                    field.onChange(Number(raw));
                  }}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }

        return (
          <FormItem className="min-w-0 flex-1 basis-[7.5rem] space-y-1">
            <FormLabel className="sr-only">{label}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder={label}
                title={label}
                className="h-[38px] bg-background text-[13px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
