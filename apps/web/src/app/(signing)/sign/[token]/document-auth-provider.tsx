'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { match } from 'ts-pattern';

import { MAXIMUM_PASSKEYS } from '@documenso/lib/constants/auth';
import type {
  TDocumentAuthOptions,
  TRecipientAccessAuthTypes,
  TRecipientActionAuthTypes,
  TRecipientAuthOptions,
} from '@documenso/lib/types/document-auth';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import {
  type Document,
  FieldType,
  type Passkey,
  type Recipient,
  type User,
} from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';

import type { DocumentActionAuthDialogProps } from './document-action-auth-dialog';
import { DocumentActionAuthDialog } from './document-action-auth-dialog';

type PasskeyData = {
  passkeys: Omit<Passkey, 'credentialId' | 'credentialPublicKey'>[];
  isInitialLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
};

export type DocumentAuthContextValue = {
  executeActionAuthProcedure: (_value: ExecuteActionAuthProcedureOptions) => Promise<void>;
  documentAuthOptions: Document['authOptions'];
  documentAuthOption: TDocumentAuthOptions;
  setDocumentAuthOptions: (_value: Document['authOptions']) => void;
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
  refetchPasskeys: () => Promise<void>;
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
  documentAuthOptions: Document['authOptions'];
  recipient: Recipient;
  user?: User | null;
  children: React.ReactNode;
}

export const DocumentAuthProvider = ({
  documentAuthOptions: initialDocumentAuthOptions,
  recipient: initialRecipient,
  user,
  children,
}: DocumentAuthProviderProps) => {
  const [documentAuthOptions, setDocumentAuthOptions] = useState(initialDocumentAuthOptions);
  const [recipient, setRecipient] = useState(initialRecipient);

  const [isCurrentlyAuthenticating, setIsCurrentlyAuthenticating] = useState(false);
  const [preferredPasskeyId, setPreferredPasskeyId] = useState<string | null>(null);

  const {
    documentAuthOption,
    recipientAuthOption,
    derivedRecipientAccessAuth,
    derivedRecipientActionAuth,
  } = useMemo(
    () =>
      extractDocumentAuthMethods({
        documentAuth: documentAuthOptions,
        recipientAuth: recipient.authOptions,
      }),
    [documentAuthOptions, recipient],
  );

  const passkeyQuery = trpc.auth.findPasskeys.useQuery(
    {
      perPage: MAXIMUM_PASSKEYS,
    },
    {
      placeholderData: (previousData) => previousData,
      enabled: derivedRecipientActionAuth === DocumentAuth.PASSKEY,
    },
  );

  const passkeyData: PasskeyData = {
    passkeys: passkeyQuery.data?.data || [],
    isInitialLoading: passkeyQuery.isInitialLoading,
    isRefetching: passkeyQuery.isRefetching,
    isError: passkeyQuery.isError,
  };

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
    .with(DocumentAuth.PASSKEY, DocumentAuth.TWO_FACTOR_AUTH, null, () => null)
    .exhaustive();

  const executeActionAuthProcedure = async (options: ExecuteActionAuthProcedureOptions) => {
    // Directly run callback if no auth required.
    if (!derivedRecipientActionAuth || options.actionTarget !== FieldType.SIGNATURE) {
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

  useEffect(() => {
    const { passkeys } = passkeyData;

    if (!preferredPasskeyId && passkeys.length > 0) {
      setPreferredPasskeyId(passkeys[0].id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeyData.passkeys]);

  // Assume that a user must be logged in for any auth requirements.
  const isAuthRedirectRequired = Boolean(
    derivedRecipientActionAuth &&
      derivedRecipientActionAuth !== DocumentAuth.EXPLICIT_NONE &&
      user?.email !== recipient.email,
  );

  const refetchPasskeys = async () => {
    await passkeyQuery.refetch();
  };

  return (
    <DocumentAuthContext.Provider
      value={{
        user,
        documentAuthOptions,
        setDocumentAuthOptions,
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
        refetchPasskeys,
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
