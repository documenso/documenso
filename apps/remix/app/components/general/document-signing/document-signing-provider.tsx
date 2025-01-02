import { createContext, useContext, useEffect, useState } from 'react';

export type DocumentSigningContextValue = {
  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: string | null;
  setSignature: (_value: string | null) => void;
  signatureValid: boolean;
  setSignatureValid: (_valid: boolean) => void;
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
  children: React.ReactNode;
}

export const DocumentSigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  children,
}: DocumentSigningProviderProps) => {
  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [signature, setSignature] = useState(initialSignature || null);
  const [signatureValid, setSignatureValid] = useState(true);

  useEffect(() => {
    if (initialSignature) {
      setSignature(initialSignature);
    }
  }, [initialSignature]);

  return (
    <DocumentSigningContext.Provider
      value={{
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
        signatureValid,
        setSignatureValid,
      }}
    >
      {children}
    </DocumentSigningContext.Provider>
  );
};

DocumentSigningProvider.displayName = 'DocumentSigningProvider';
