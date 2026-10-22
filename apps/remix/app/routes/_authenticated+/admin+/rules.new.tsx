import { IS_DOCUMENSO_CLOUD } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router';

import { AdminRuleForm, type TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Create Rule`);
}

export default function AdminRuleCreatePage() {
  const { t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const { mutateAsync: createRule } = trpc.admin.rule.create.useMutation();

  const onSubmit = async (data: TAdminRuleFormSchema) => {
    try {
      const rule = await createRule(data);

      toast({
        title: t`Rule created`,
        description: t`"${rule.name}" has been created.`,
        duration: 5000,
      });

      await navigate(`/admin/rules/${rule.id}`);
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: t`Something went wrong`,
        description: error.message || t`We were unable to create the rule. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  if (!IS_DOCUMENSO_CLOUD()) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-6 font-semibold text-4xl">
        <Trans>Create rule</Trans>
      </h2>

      <AdminRuleForm rule={null} onSubmit={onSubmit} onCancel={() => void navigate('/admin/rules')} />
    </div>
  );
}
