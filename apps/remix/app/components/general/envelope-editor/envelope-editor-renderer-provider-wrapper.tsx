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
      envelope={envelope}
      envelopeItems={envelope.envelopeItems}
      token={token}
      presignToken={presignedToken}
      version="current"
      fields={envelope.fields}
      recipients={envelope.recipients}
    >
      {children}
    </EnvelopeRenderProvider>
  );
};
