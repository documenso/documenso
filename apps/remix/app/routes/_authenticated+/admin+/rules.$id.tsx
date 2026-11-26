import { IS_DOCUMENSO_CLOUD } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AdminRuleDeleteDialog } from '~/components/dialogs/admin-rule-delete-dialog';
import { AdminRuleForm, type TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import { AdminRuleModeBadge } from '~/components/general/admin-rules/admin-rule-badges';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminRuleMatchesTable } from '~/components/tables/admin-rule-matches-table';
import { appMetaTags } from '~/utils/meta';
import type { Route } from './+types/rules.$id';

export function meta() {
  return appMetaTags(msg`Edit Rule`);
}

export default function AdminRuleEditPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const ruleId = params.id;

  const trpcUtils = trpc.useUtils();

  const { data: rule, isPending: isLoadingRule } = trpc.admin.rule.get.useQuery(
    { ruleId },
    {
      retry: false,
    },
  );

  const [matchesPage, setMatchesPage] = useState({ page: 1, perPage: 10 });

  const { mutateAsync: updateRule } = trpc.admin.rule.update.useMutation({
    onSuccess: async () => {
      await Promise.all([trpcUtils.admin.rule.get.invalidate({ ruleId }), trpcUtils.admin.rule.getMany.invalidate()]);
    },
  });

  if (!IS_DOCUMENSO_CLOUD()) {
    return null;
  }

  if (isLoadingRule) {
    return <SpinnerBox className="py-32" />;
  }

  if (!rule) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Rule not found`,
            subHeading: msg`404 Rule not found`,
            message: msg`The rule you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={'/admin/rules'}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  const onSubmit = async (data: TAdminRuleFormSchema) => {
    try {
      await updateRule({
        ruleId: rule.id,
        data,
      });

      toast({
        title: t`Rule updated`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: t`Something went wrong`,
        description: error.message || t`We were unable to save the rule. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={rule.name}
        badge={<AdminRuleModeBadge mode={rule.mode} />}
        subtitle={rule.description || <Trans>Edit the rule's trigger, conditions and actions</Trans>}
      >
        <AdminRuleDeleteDialog ruleId={rule.id} ruleName={rule.name} onDeleted={() => void navigate('/admin/rules')} />
      </SettingsHeader>

      <AdminRuleForm key={rule.id} rule={rule} onSubmit={onSubmit} onCancel={() => void navigate('/admin/rules')} />

      <div className="mt-16">
        <SettingsHeader
          hideDivider
          title={<Trans>Recent matches</Trans>}
          subtitle={<Trans>Events this rule matched recently, including monitor mode evaluations.</Trans>}
        />

        <AdminRuleMatchesTable
          filters={{ ruleId }}
          page={matchesPage.page}
          perPage={matchesPage.perPage}
          onPaginationChange={(page, perPage) => setMatchesPage({ page, perPage })}
        />
      </div>
    </div>
  );
}
