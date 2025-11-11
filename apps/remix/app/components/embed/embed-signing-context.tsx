import { createContext, useContext } from 'react';

export type EmbedSigningContextValue = {
  isEmbed: true;
  allowDocumentRejection: boolean;
  isNameLocked: boolean;
  isEmailLocked: boolean;
  hidePoweredBy: boolean;
  onDocumentCompleted: (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
  }) => void;
  onDocumentError: () => void;
  onDocumentRejected: (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
    reason?: string;
  }) => void;
  onDocumentReady: () => void;
  onFieldSigned: (data: { fieldId?: number; value?: string; isBase64?: boolean }) => void;
  onFieldUnsigned: (data: { fieldId?: number }) => void;
};

const EmbedSigningContext = createContext<EmbedSigningContextValue | null>(null);

export const useEmbedSigningContext = () => {
  return useContext(EmbedSigningContext);
};

export const useRequiredEmbedSigningContext = () => {
  const context = useEmbedSigningContext();

  if (!context) {
    throw new Error('useRequiredEmbedSigningContext must be used within EmbedSigningProvider');
  }

  return context;
};

export type EmbedSigningProviderProps = {
  allowDocumentRejection?: boolean;
  isNameLocked?: boolean;
  isEmailLocked?: boolean;
  hidePoweredBy?: boolean;
  onDocumentCompleted: (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
  }) => void;
  onDocumentError: () => void;
  onDocumentRejected: (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
    reason?: string;
  }) => void;
  onDocumentReady: () => void;
  onFieldSigned: (data: { fieldId?: number; value?: string; isBase64?: boolean }) => void;
  onFieldUnsigned: (data: { fieldId?: number }) => void;
  children: React.ReactNode;
};

export const EmbedSigningProvider = ({
  allowDocumentRejection = false,
  isNameLocked = false,
  isEmailLocked = true,
  hidePoweredBy = false,
  onDocumentCompleted,
  onDocumentError,
  onDocumentRejected,
  onDocumentReady,
  onFieldSigned,
  onFieldUnsigned,
  children,
}: EmbedSigningProviderProps) => {
  return (
    <EmbedSigningContext.Provider
      value={{
        isEmbed: true,
        allowDocumentRejection,
        isNameLocked,
        isEmailLocked,
        hidePoweredBy,
        onDocumentCompleted,
        onDocumentError,
        onDocumentRejected,
        onDocumentReady,
        onFieldSigned,
        onFieldUnsigned,
      }}
    >
      {children}
    </EmbedSigningContext.Provider>
  );
};
