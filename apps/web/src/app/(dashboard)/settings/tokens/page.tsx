import { DateTime } from 'luxon';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getUserTokens } from '@documenso/lib/server-only/public-api/get-all-user-tokens';
import { Button } from '@documenso/ui/primitives/button';

import DeleteTokenDialog from '~/components/(dashboard)/settings/token/delete-token-dialog';
import { LocaleDate } from '~/components/formatter/locale-date';
import { ApiTokenForm } from '~/components/forms/token';

export default async function ApiTokensPage() {
  const { user } = await getRequiredServerComponentSession();

  const tokens = await getUserTokens({ userId: user.id });

  return (
    <div>
      <h3 className="text-2xl font-semibold">API ტოკენები</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        ამ გვერდზე შეგიძლიათ შექმნათ ახალი API ტოკენები და მართოთ არსებული. <br /> თქვენ შეგიძლიათ
        ნახოთ ჩვენი swagger დოკუმენტები{' '}
        <a
          className="text-primary underline"
          href={`${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/openapi`}
          target="_blank"
        >
          აქ
        </a>
      </p>

      <hr className="my-4" />

      <ApiTokenForm className="max-w-xl" />

      <hr className="mb-4 mt-8" />

      <h4 className="text-xl font-medium">თქვენი არსებული ტოკენები</h4>

      {tokens.length === 0 && (
        <div className="mb-4">
          <p className="text-muted-foreground mt-2 text-sm italic">
            თქვენი ტოკენები შექმნისთანავე აქ გამოჩნდება.
          </p>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mt-4 flex max-w-xl flex-col gap-y-4">
          {tokens.map((token) => (
            <div key={token.id} className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between gap-x-4">
                <div>
                  <h5 className="text-base">{token.name}</h5>

                  <p className="text-muted-foreground mt-2 text-xs">
                    შექმნილია <LocaleDate date={token.createdAt} format={DateTime.DATETIME_FULL} />
                  </p>
                  {token.expires ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      ვადა იწურება{' '}
                      <LocaleDate date={token.expires} format={DateTime.DATETIME_FULL} />
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      ტოკენს არ აქვს ვადის გასვლის თარიღი
                    </p>
                  )}
                </div>

                <div>
                  <DeleteTokenDialog token={token}>
                    <Button variant="destructive">წაშლა</Button>
                  </DeleteTokenDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
