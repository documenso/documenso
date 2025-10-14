import { type PropsWithChildren, createContext, useContext } from 'react';

import type { Recipient } from '@prisma/client';

import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';

export interface DocumentSigningRecipientContextValue {
  /**
   * The recipient who is currently signing the document.
   * In regular mode, this is the actual signer.
   * In assistant mode, this is the recipient who is helping fill out the document.
   */
  recipient: Pick<
    Recipient | RecipientWithFields,
    'name' | 'email' | 'token' | 'role' | 'authOptions'
  >;

  /**
   * Only present in assistant mode.
   * The recipient on whose behalf we're filling out the document.
   */
  targetSigner: RecipientWithFields | null;

  /**
   * Whether we're in assistant mode (one recipient filling out for another)
   */
  isAssistantMode: boolean;
}

const DocumentSigningRecipientContext = createContext<DocumentSigningRecipientContextValue | null>(
  null,
);

export interface DocumentSigningRecipientProviderProps extends PropsWithChildren {
  recipient: Pick<
    Recipient | RecipientWithFields,
    'name' | 'email' | 'token' | 'role' | 'authOptions'
  >;
  targetSigner?: RecipientWithFields | null;
}

export const DocumentSigningRecipientProvider = ({
  children,
  recipient,
  targetSigner = null,
}: DocumentSigningRecipientProviderProps) => {
  return (
    <DocumentSigningRecipientContext.Provider
      value={{
        recipient,
        targetSigner,
        isAssistantMode: !!targetSigner,
      }}
    >
      {children}
    </DocumentSigningRecipientContext.Provider>
  );
};

export function useDocumentSigningRecipientContext() {
  const context = useContext(DocumentSigningRecipientContext);

  if (!context) {
    throw new Error('useDocumentSigningRecipientContext must be used within a RecipientProvider');
  }

  return context;
}
