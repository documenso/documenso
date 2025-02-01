'use client';

import { type PropsWithChildren, createContext, useContext } from 'react';

import type { Recipient } from '@documenso/prisma/client';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';

export interface RecipientContextValue {
  /**
   * The recipient who is currently signing the document.
   * In regular mode, this is the actual signer.
   * In assistant mode, this is the recipient who is helping fill out the document.
   */
  recipient: Recipient | RecipientWithFields;

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

const RecipientContext = createContext<RecipientContextValue | null>(null);

export interface RecipientProviderProps extends PropsWithChildren {
  recipient: Recipient | RecipientWithFields;
  targetSigner?: RecipientWithFields | null;
}

export const RecipientProvider = ({
  children,
  recipient,
  targetSigner = null,
}: RecipientProviderProps) => {
  // console.log({
  //   recipient,
  //   targetSigner,
  //   isAssistantMode: !!targetSigner,
  // });
  return (
    <RecipientContext.Provider
      value={{
        recipient,
        targetSigner,
        isAssistantMode: !!targetSigner,
      }}
    >
      {children}
    </RecipientContext.Provider>
  );
};

export function useRecipientContext() {
  const context = useContext(RecipientContext);

  if (!context) {
    throw new Error('useRecipientContext must be used within a RecipientProvider');
  }

  return context;
}
