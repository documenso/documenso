'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { match } from 'ts-pattern';

import { MAXIMUM_PASSKEYS } from '@documenso/lib/constants/auth';
import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import type {
  TDocumentAuthOptions,
  TRecipientAccessAuthTypes,
  TRecipientActionAuthTypes,
  TRecipientAuthOptions,
} from '@documenso/lib/types/document-auth';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import type { Document, Passkey, Recipient, User } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';

import type { DocumentActionAuthDialogProps } from './document-action-auth-dialog';
import { DocumentActionAuthDialog } from './document-action-auth-dialog';

type PasskeyData = {
  passkeys: Omit<Passkey, 'credentialId' | 'credentialPublicKey'>[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isLoadingError: boolean;
};

export type DocumentAuthContextValue = {
  executeActionAuthProcedure: (_value: ExecuteActionAuthProcedureOptions) => Promise<void>;
  document: Document;
  documentAuthOption: TDocumentAuthOptions;
  setDocument: (_value: Document) => void;
  recipient: Recipient;
  recipientAuthOption: TRecipientAuthOptions;
  setRecipient: (_value: Recipient) => void;
  derivedRecipientAccessAuth: TRecipientAccessAuthTypes | null;
  derivedRecipientActionAuth: TRecipientActionAuthTypes | null;
  isAuthRedirectRequired: boolean;
  isCurrentlyAuthenticating: boolean;
  setIsCurrentlyAuthenticating: (_value: boolean) => void;
  passkeyData: PasskeyData;
  preferredPasskeyId: string | null;
  setPreferredPasskeyId: (_value: string | null) => void;
  user?: User | null;
};

const DocumentAuthContext = createContext<DocumentAuthContextValue | null>(null);

export const useDocumentAuthContext = () => {
  return useContext(DocumentAuthContext);
};

export const useRequiredDocumentAuthContext = () => {
  const context = useDocumentAuthContext();

  if (!context) {
    throw new Error('Document auth context is required');
  }

  return context;
};

export interface DocumentAuthProviderProps {
  document: Document;
  recipient: Recipient;
  user?: User | null;
  children: React.ReactNode;
}

export const DocumentAuthProvider = ({
  document: initialDocument,
  recipient: initialRecipient,
  user,
  children,
}: DocumentAuthProviderProps) => {
  const [document, setDocument] = useState(initialDocument);
  const [recipient, setRecipient] = useState(initialRecipient);

  const [isCurrentlyAuthenticating, setIsCurrentlyAuthenticating] = useState(false);
  const [preferredPasskeyId, setPreferredPasskeyId] = useState<string | null>(null);

  const passkeyQuery = trpc.auth.findPasskeys.useQuery(
    {
      perPage: MAXIMUM_PASSKEYS,
    },
    {
      keepPreviousData: true,
      enabled: false,
    },
  );

  const passkeyData: PasskeyData = {
    passkeys: passkeyQuery.data?.data || [],
    isLoading: passkeyQuery.isLoading,
    isInitialLoading: passkeyQuery.isInitialLoading,
    isLoadingError: passkeyQuery.isLoadingError,
  };

  const {
    documentAuthOption,
    recipientAuthOption,
    derivedRecipientAccessAuth,
    derivedRecipientActionAuth,
  } = useMemo(
    () =>
      extractDocumentAuthMethods({
        documentAuth: document.authOptions,
        recipientAuth: recipient.authOptions,
      }),
    [document, recipient],
  );

  /**
   * By default, select the first passkey since it's pre sorted by most recently used.
   */
  useEffect(() => {
    if (!preferredPasskeyId && passkeyQuery.data && passkeyQuery.data.data.length > 0) {
      setPreferredPasskeyId(passkeyQuery.data.data[0].id);
    }
  }, [passkeyQuery.data, preferredPasskeyId]);

  /**
   * Only fetch passkeys if required.
   */
  useEffect(() => {
    if (derivedRecipientActionAuth === DocumentAuth.PASSKEY) {
      void passkeyQuery.refetch();
    }
  }, [derivedRecipientActionAuth, passkeyQuery]);

  const [documentAuthDialogPayload, setDocumentAuthDialogPayload] =
    useState<ExecuteActionAuthProcedureOptions | null>(null);

  /**
   * The pre calculated auth payload if the current user is authenticated correctly
   * for the `derivedRecipientActionAuth`.
   *
   * Will be `null` if the user still requires authentication, or if they don't need
   * authentication.
   */
  const preCalculatedActionAuthOptions = match(derivedRecipientActionAuth)
    .with(DocumentAuth.ACCOUNT, () => {
      if (recipient.email !== user?.email) {
        return null;
      }

      return {
        type: DocumentAuth.ACCOUNT,
      };
    })
    .with(DocumentAuth.EXPLICIT_NONE, () => ({
      type: DocumentAuth.EXPLICIT_NONE,
    }))
    .with(DocumentAuth.PASSKEY, null, () => null)
    .exhaustive();

  const executeActionAuthProcedure = async (options: ExecuteActionAuthProcedureOptions) => {
    // Directly run callback if no auth required.
    if (!derivedRecipientActionAuth) {
      await options.onReauthFormSubmit();
      return;
    }

    // Run callback with precalculated auth options if available.
    if (preCalculatedActionAuthOptions) {
      setDocumentAuthDialogPayload(null);
      await options.onReauthFormSubmit(preCalculatedActionAuthOptions);
      return;
    }

    // Request the required auth from the user.
    setDocumentAuthDialogPayload({
      ...options,
    });
  };

  const isAuthRedirectRequired = Boolean(
    DOCUMENT_AUTH_TYPES[derivedRecipientActionAuth || '']?.isAuthRedirectRequired &&
      !preCalculatedActionAuthOptions,
  );

  return (
    <DocumentAuthContext.Provider
      value={{
        user,
        document,
        setDocument,
        executeActionAuthProcedure,
        recipient,
        setRecipient,
        documentAuthOption,
        recipientAuthOption,
        derivedRecipientAccessAuth,
        derivedRecipientActionAuth,
        isAuthRedirectRequired,
        isCurrentlyAuthenticating,
        setIsCurrentlyAuthenticating,
        passkeyData,
        preferredPasskeyId,
        setPreferredPasskeyId,
      }}
    >
      {children}

      {documentAuthDialogPayload && derivedRecipientActionAuth && (
        <DocumentActionAuthDialog
          open={true}
          onOpenChange={() => setDocumentAuthDialogPayload(null)}
          onReauthFormSubmit={documentAuthDialogPayload.onReauthFormSubmit}
          actionTarget={documentAuthDialogPayload.actionTarget}
          documentAuthType={derivedRecipientActionAuth}
        />
      )}
    </DocumentAuthContext.Provider>
  );
};

type ExecuteActionAuthProcedureOptions = Omit<
  DocumentActionAuthDialogProps,
  'open' | 'onOpenChange' | 'documentAuthType' | 'recipientRole'
>;

DocumentAuthProvider.displayName = 'DocumentAuthProvider';
