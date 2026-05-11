import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';

export const EnvelopeEditorRenderProviderWrapper = ({
  children,
  token,
  presignedToken,
}: {
  children: React.ReactNode;
  token?: string;
  presignedToken?: string;
}) => {
  const { envelope } = useCurrentEnvelopeEditor();

  return (
    <EnvelopeRenderProvider
      version="current"
      envelope={envelope}
      envelopeItems={envelope.envelopeItems}
      fields={envelope.fields}
      recipients={envelope.recipients}
      token={token}
      presignToken={presignedToken}
    >
      {children}
    </EnvelopeRenderProvider>
  );
};
