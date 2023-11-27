import { ApiTokenForm } from '~/components/forms/token';

export default function ApiToken() {
  return (
    <div>
      <h3 className="text-lg font-medium">API Token</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        On this page, you can create new API tokens and manage the existing ones.
      </p>

      <hr className="my-4" />

      <ApiTokenForm className="max-w-xl" />
    </div>
  );
}
