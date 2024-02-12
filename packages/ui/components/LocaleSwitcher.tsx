'use client';
import React from 'react';
import {useTranslation} from '@documenso/lib/i18n/client';
import { switchLocaleAction } from '@documenso/ee/server-only/i18n/provider/switch-locale';
// We removed the `locale` prop because we can get it from the hook
export default function ChangeLocale() {
  const {i18n, t} = useTranslation('common');
  // We can also use our custom hook instead of `i18n.resolvedLanguage`
  // const locale = useLocale();

  return (
    <div>
      <select
        onChange={e => switchLocaleAction(e.target.value)}
        value={i18n.resolvedLanguage}
      >
        <option value="en">🇺🇸 {t('english')}</option>
        <option value="zh-CN">🇨🇳 {t('chinese')}</option>
        <option value="sv">🇸🇪 {t('swedish')}</option>
      </select>
    </div>
  );
}
