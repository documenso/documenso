'use client';

import React from 'react';

import { useParams, useRouter, useSelectedLayoutSegments } from 'next/navigation';

const ChangeLocale = () => {
  const router = useRouter();
  const params = useParams();
  const urlSegments = useSelectedLayoutSegments();

  const handleLocaleChange = (event: { target: { value: string } }) => {
    const newLocale = event.target.value;
    const link = `/${newLocale}/${urlSegments.join('/')}`;

    // This is used by the Header component which is used in `app/[locale]/layout.tsx` file,
    // urlSegments will contain the segments after the locale.
    // We replace the URL with the new locale and the rest of the segments.
    router.push(link);
  };

  return (
    <div>
      <select onChange={handleLocaleChange} value={params?.locale}>
        <option value="en">🇺🇸</option>
        <option value="fr">🇫🇷</option>
        <option value="sv">🇸🇪</option>
      </select>
    </div>
  );
};

export default ChangeLocale;
