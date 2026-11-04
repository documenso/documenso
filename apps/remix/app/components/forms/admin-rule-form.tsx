import {
  ADMIN_RULE_MODES,
  ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS,
  ADMIN_RULE_TRIGGERS,
} from '@documenso/lib/constants/admin-rules';
import {
  ADMIN_RULE_DEFINITION_ISSUE_MAP,
  ADMIN_RULE_MODE_DESCRIPTION_MAP,
  ADMIN_RULE_MODE_MAP,
  ADMIN_RULE_TRIGGER_DESCRIPTION_MAP,
  ADMIN_RULE_TRIGGER_MAP,
} from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleDefinition, TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import { getAdminRuleDefinitionIssues } from '@documenso/lib/utils/admin-rules';
import { ZCreateAdminRuleRequestSchema } from '@documenso/trpc/server/admin-router/rules/create-admin-rule.types';
import type { TGetAdminRuleResponse } from '@documenso/trpc/server/admin-router/rules/get-admin-rule.types';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card } from '@documenso/ui/primitives/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { RadioGroupSegmented, RadioGroupSegmentedItem } from '@documenso/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  type AdminOrganisationOption,
  AdminOrganisationsMultiSelectCombobox,
} from '~/components/general/admin-rules/admin-organisations-multiselect-combobox';
import { buildEmptyAdminRuleGroup } from '~/components/general/admin-rules/admin-rule-condition-group-fields';
import { AdminRuleDefinitionFields } from '~/components/general/admin-rules/admin-rule-definition-fields';
import { AdminRuleLastMatch } from '~/components/general/admin-rules/admin-rule-last-match';
import { AdminRuleSectionChip } from '~/components/general/admin-rules/admin-rule-section-chip';
import { AdminRuleTester } from '~/components/general/admin-rules/admin-rule-tester';

const ZAdminRuleFormSchema = ZCreateAdminRuleRequestSchema.pick({
  name: true,
  description: true,
  trigger: true,
  mode: true,
  stopOnMatch: true,
  definition: true,
  exemptOrganisationIds: true,
}).superRefine((data, ctx) => {
  for (const issue of getAdminRuleDefinitionIssues(data.trigger, data.definition)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['definition', ...issue.path],
      message: ADMIN_RULE_DEFINITION_ISSUE_MAP[issue.code].id,
    });
  }
});

export type TAdminRuleFormSchema = z.infer<typeof ZAdminRuleFormSchema>;

/**
 * react-hook-form cannot derive paths through the recursive condition tree, so the group and
 * condition components address nodes by plain string paths and cast them to these top-level
 * paths, which hold values of the same type, when calling the form API.
 */
export type AdminRuleConditionGroupPath = 'definition.when';
export type AdminRuleConditionPath = `${AdminRuleConditionGroupPath}.children.${number}`;

export type AdminRuleFormProps = {
  rule: TGetAdminRuleResponse | null;
  onSubmit: (data: TAdminRuleFormSchema) => Promise<void> | void;
  onCancel: () => void;
};

export const AdminRuleForm = ({ rule, onSubmit, onCancel }: AdminRuleFormProps) => {
  const { t, i18n } = useLingui();

  const form = useForm<TAdminRuleFormSchema>({
    resolver: zodResolver(ZAdminRuleFormSchema, {
      errorMap: (issue, ctx) => {
        if (issue.code === z.ZodIssueCode.too_small && issue.type === 'array') {
          const descriptor =
            issue.path.at(-1) === 'actions' ? msg`Add at least one action` : msg`Add at least one condition`;

          return {
            message: descriptor.id,
          };
        }

        return {
          message: ctx.defaultError,
        };
      },
    }),
    defaultValues: {
      name: rule?.name ?? '',
      description: rule?.description ?? null,
      trigger: rule?.trigger ?? 'DOCUMENT_SENT',
      mode: rule?.mode ?? 'MONITOR',
      stopOnMatch: rule?.stopOnMatch ?? true,
      definition: rule?.definition ?? buildEmptyAdminRuleDefinition('DOCUMENT_SENT'),
      // Only organisations that still exist, so deleted ones drop off on the next save.
      exemptOrganisationIds: rule?.exemptOrganisations.map((organisation) => organisation.id) ?? [],
    },
  });

  const trigger = useWatch({ control: form.control, name: 'trigger' });

  // The form only holds the ids, so the picker keeps the selected records for its labels.
  const [exemptOrganisations, setExemptOrganisations] = useState<AdminOrganisationOption[]>(
    rule?.exemptOrganisations ?? [],
  );

  const supportsExemptions = ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS[trigger];

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async (data: TAdminRuleFormSchema) => {
    await onSubmit({
      ...data,
      description: data.description || null,
    });
  };

  const onTriggerChange = (nextTrigger: TAdminRuleTrigger) => {
    form.setValue('trigger', nextTrigger, { shouldDirty: true });

    form.setValue('definition', buildEmptyAdminRuleDefinition(nextTrigger), { shouldDirty: true });

    if (!ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS[nextTrigger]) {
      form.setValue('exemptOrganisationIds', [], { shouldDirty: true });
      setExemptOrganisations([]);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={isSubmitting} className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1_1_32rem] flex-col gap-5">
            <Card className="border p-6 shadow-none">
              <div className="grid gap-[18px]">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required className="font-semibold">
                        <Trans>Rule name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t`e.g. Suspicious name change`} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">
                        <Trans>Description</Trans>{' '}
                        <span className="font-normal text-muted-foreground">
                          <Trans>(optional)</Trans>
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} placeholder={t`What this rule protects against`} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">
                        <Trans>Mode</Trans>
                      </FormLabel>
                      <FormControl>
                        <RadioGroupSegmented
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid w-full grid-cols-3 gap-1 p-1"
                        >
                          {ADMIN_RULE_MODES.map((option) => (
                            <RadioGroupSegmentedItem key={option} value={option} className="px-2.5 py-2 text-[13px]">
                              {t(ADMIN_RULE_MODE_MAP[option])}
                            </RadioGroupSegmentedItem>
                          ))}
                        </RadioGroupSegmented>
                      </FormControl>
                      <FormDescription>{t(ADMIN_RULE_MODE_DESCRIPTION_MAP[field.value])}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stopOnMatch"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 space-y-0">
                      <div className="min-w-0 space-y-0.5">
                        <FormLabel className="font-semibold">
                          <Trans>Stop on match</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>When this rule matches, skip any lower priority rules for the same trigger.</Trans>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="border px-6 pt-5 pb-6 shadow-none">
              <div className="mb-3.5 flex items-center gap-3">
                <AdminRuleSectionChip variant="dark">{t`When`}</AdminRuleSectionChip>
                <span className="text-muted-foreground text-sm">
                  <Trans>this event happens</Trans>
                </span>
              </div>

              <FormField
                control={form.control}
                name="trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">
                      <Trans>Trigger</Trans>
                    </FormLabel>
                    <Select value={field.value} onValueChange={(value) => onTriggerChange(value as TAdminRuleTrigger)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent position="popper">
                        {ADMIN_RULE_TRIGGERS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(ADMIN_RULE_TRIGGER_MAP[option])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(ADMIN_RULE_TRIGGER_DESCRIPTION_MAP[field.value])}{' '}
                      <Trans>Changing the trigger resets the conditions and actions below.</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            {supportsExemptions && (
              <Card className="border px-6 pt-5 pb-6 shadow-none">
                <div className="mb-3.5 flex items-center gap-3">
                  <AdminRuleSectionChip variant="muted">{t`Except`}</AdminRuleSectionChip>
                  <span className="text-muted-foreground text-sm">
                    <Trans>skip this rule for these organisations</Trans>
                  </span>
                </div>

                <FormField
                  control={form.control}
                  name="exemptOrganisationIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">
                        <Trans>Exempt organisations</Trans>
                      </FormLabel>
                      <FormControl>
                        <AdminOrganisationsMultiSelectCombobox
                          selectedOrganisations={exemptOrganisations}
                          onChange={(organisations) => {
                            setExemptOrganisations(organisations);
                            field.onChange(organisations.map((organisation) => organisation.id));
                          }}
                          className="w-full"
                          dataTestId="admin-rule-exempt-organisations"
                        />
                      </FormControl>
                      <FormDescription>
                        <Trans>
                          An escape hatch for organisations this rule should never run against. Leave empty to apply the
                          rule everywhere.
                        </Trans>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            )}

            <AdminRuleDefinitionFields key={trigger} trigger={trigger} />

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <div className="flex gap-2.5">
                <Button type="button" variant="outline" onClick={onCancel}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={isSubmitting}>
                  <Trans>Save</Trans>
                </Button>
              </div>
            </div>
          </div>

          <aside
            className={cn(
              'flex min-w-0 flex-[0_1_17rem] flex-col gap-5',
              'xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto',
            )}
          >
            <AdminRuleFormTester key={trigger} trigger={trigger} />

            {rule && (
              <Card className="border px-[18px] py-4 shadow-none">
                <h3 className="mb-2.5 font-semibold text-sm">
                  <Trans>Details</Trans>
                </h3>

                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                  <dt className="text-muted-foreground">
                    <Trans>Matches, 7d</Trans>
                  </dt>
                  <dd className="tabular-nums">{rule.matchCountLast7Days}</dd>

                  <dt className="text-muted-foreground">
                    <Trans>Last match</Trans>
                  </dt>
                  <dd>
                    <AdminRuleLastMatch lastMatchedAt={rule.lastMatchedAt} ruleCreatedAt={rule.createdAt} />
                  </dd>

                  <dt className="text-muted-foreground">
                    <Trans>Updated</Trans>
                  </dt>
                  <dd>{i18n.date(rule.updatedAt)}</dd>
                </dl>
              </Card>
            )}
          </aside>
        </fieldset>
      </form>
    </Form>
  );
};

type AdminRuleFormTesterProps = {
  trigger: TAdminRuleTrigger;
};

/**
 * Watches the mode and definition for the tester, so typing in the editor re-renders the tester
 * rather than the whole form.
 */
const AdminRuleFormTester = ({ trigger }: AdminRuleFormTesterProps) => {
  const form = useFormContext<TAdminRuleFormSchema>();

  const mode = useWatch({ control: form.control, name: 'mode' });
  const definition = useWatch({ control: form.control, name: 'definition' });

  return <AdminRuleTester trigger={trigger} mode={mode} definition={definition} />;
};

const buildEmptyAdminRuleDefinition = (trigger: TAdminRuleTrigger): TAdminRuleDefinition => ({
  when: buildEmptyAdminRuleGroup(trigger),
  actions: [],
});
