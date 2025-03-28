import { createContext, useContext, useState } from 'react';

import { isBase64Image } from '@documenso/lib/constants/signatures';

export type DocumentSigningContextValue = {
  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: string | null;
  setSignature: (_value: string | null) => void;
};

const DocumentSigningContext = createContext<DocumentSigningContextValue | null>(null);

export const useDocumentSigningContext = () => {
  return useContext(DocumentSigningContext);
};

export const useRequiredDocumentSigningContext = () => {
  const context = useDocumentSigningContext();

  if (!context) {
    throw new Error('Signing context is required');
  }

  return context;
};

export interface DocumentSigningProviderProps {
  fullName?: string | null;
  email?: string | null;
  signature?: string | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
  children: React.ReactNode;
}

export const DocumentSigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
  children,
}: DocumentSigningProviderProps) => {
  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');

  // Ensure the user signature doesn't show up if it's not allowed.
  const [signature, setSignature] = useState(
    (() => {
      const sig = initialSignature || '';
      const isBase64 = isBase64Image(sig);

      if (isBase64 && (uploadSignatureEnabled || drawSignatureEnabled)) {
        return sig;
      }

      if (!isBase64 && typedSignatureEnabled) {
        return sig;
      }

      return null;
    })(),
  );

  return (
    <DocumentSigningContext.Provider
      value={{
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
      }}
    >
      {children}
    </DocumentSigningContext.Provider>
  );
};

DocumentSigningProvider.displayName = 'DocumentSigningProvider';
