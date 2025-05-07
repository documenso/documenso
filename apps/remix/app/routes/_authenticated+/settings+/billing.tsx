import { Trans } from '@lingui/react/macro';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Billing');
}

export default function TeamsSettingBillingPage() {
  return (
    <div>
      <div className="flex flex-row items-end justify-between">
        <div>
          <h3 className="text-2xl font-semibold">
            <Trans>Billing</Trans>
          </h3>

          <div className="text-muted-foreground mt-2 text-sm">
            <Trans>Billing has been moved to organisations</Trans>
          </div>
        </div>
      </div>
    </div>
  );
}
