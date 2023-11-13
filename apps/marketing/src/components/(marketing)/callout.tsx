'use client';

import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { Button } from '@documenso/ui/primitives/button';

export type CalloutProps = {
  starCount?: number;
  [key: string]: unknown;
  locale?: LocaleTypes;
};

export const Callout = ({ locale }: CalloutProps) => {
  const { t } = useTranslation(locale ?? 'fr', 'marketing');

  const onSignUpClick = () => {
    const el = document.getElementById('email');

    if (el) {
      const { top } = el.getBoundingClientRect();

      window.scrollTo({
        top: top - 120,
        behavior: 'smooth',
      });

      setTimeout(() => {
        el.focus();
      }, 500);
    }
  };

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <Button
        type="button"
        variant="outline"
        className="rounded-full bg-transparent backdrop-blur-sm"
        onClick={onSignUpClick}
      >
        {t(`get-early-adopter`)}
        <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs">
          {t(`forever`)}
        </span>
      </Button>
    </div>
  );
};
