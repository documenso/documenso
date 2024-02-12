'use client';
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import {useTranslation} from '@documenso/lib/i18n/client';
import { switchLocaleAction } from '@documenso/ee/server-only/i18n/provider/switch-locale';
// We removed the `locale` prop because we can get it from the hook
export function LocaleSwitcher() {
  const {i18n, t} = useTranslation('common');
  // We can also use our custom hook instead of `i18n.resolvedLanguage`
  // const locale = useLocale();

  return (
    <div>

      <Select defaultValue={i18n.resolvedLanguage} onValueChange={(locale) => {
        switchLocaleAction(locale)
      }}>
      <SelectTrigger className="text-muted-foreground max-w-[200px]">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
        <SelectItem value="en">🇺🇸 {t('english')}</SelectItem>
        <SelectItem value="zh-CN">🇨🇳 {t('chinese')}</SelectItem>
        <SelectItem value="sv">🇸🇪 {t('swedish')}</SelectItem>
      </SelectContent>
    </Select>
    </div>
  );
}
