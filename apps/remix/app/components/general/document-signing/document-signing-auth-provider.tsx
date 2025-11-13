import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { type Envelope, FieldType, type Passkey, type Recipient } from '@prisma/client';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { MAXIMUM_PASSKEYS } from '@documenso/lib/constants/auth';
import type {
  TDocumentAuthOptions,
  TRecipientAccessAuthTypes,
  TRecipientActionAuthTypes,
  TRecipientAuthOptions,
} from '@documenso/lib/types/document-auth';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { trpc } from '@documenso/trpc/react';

import type { DocumentSigningAuthDialogProps } from './document-signing-auth-dialog';
import { DocumentSigningAuthDialog } from './document-signing-auth-dialog';

type PasskeyData = {
  passkeys: Omit<Passkey, 'credentialId' | 'credentialPublicKey'>[];
  isInitialLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
};

type SigningAuthRecipient = Pick<
  Recipient,
  'authOptions' | 'email' | 'role' | 'name' | 'token' | 'id'
>;

export type DocumentSigningAuthContextValue = {
  executeActionAuthProcedure: (_value: ExecuteActionAuthProcedureOptions) => Promise<void>;
  documentAuthOptions: Envelope['authOptions'];
  documentAuthOption: TDocumentAuthOptions;
  setDocumentAuthOptions: (_value: Envelope['authOptions']) => void;
  recipient: SigningAuthRecipient;
  recipientAuthOption: TRecipientAuthOptions;
  setRecipient: (_value: SigningAuthRecipient) => void;
  derivedRecipientAccessAuth: TRecipientAccessAuthTypes[];
  derivedRecipientActionAuth: TRecipientActionAuthTypes[];
  isAuthRedirectRequired: boolean;
  isDirectTemplate?: boolean;
  isCurrentlyAuthenticating: boolean;
  setIsCurrentlyAuthenticating: (_value: boolean) => void;
  passkeyData: PasskeyData;
  preferredPasskeyId: string | null;
  setPreferredPasskeyId: (_value: string | null) => void;
  user?: SessionUser | null;
  refetchPasskeys: () => Promise<void>;
};

const DocumentSigningAuthContext = createContext<DocumentSigningAuthContextValue | null>(null);

export const useDocumentSigningAuthContext = () => {
  return useContext(DocumentSigningAuthContext);
};

export const useRequiredDocumentSigningAuthContext = () => {
  const context = useDocumentSigningAuthContext();

  if (!context) {
    throw new Error('Document signing auth context is required');
  }

  return context;
};

export interface DocumentSigningAuthProviderProps {
  documentAuthOptions: Envelope['authOptions'];
  recipient: SigningAuthRecipient;
  isDirectTemplate?: boolean;
  user?: SessionUser | null;
  children: React.ReactNode;
}

export const DocumentSigningAuthProvider = ({
  documentAuthOptions: initialDocumentAuthOptions,
  recipient: initialRecipient,
  isDirectTemplate = false,
  user,
  children,
}: DocumentSigningAuthProviderProps) => {
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

  const passkeyQuery = trpc.auth.passkey.find.useQuery(
    {
      perPage: MAXIMUM_PASSKEYS,
    },
    {
      placeholderData: (previousData) => previousData,
      enabled: derivedRecipientActionAuth?.includes(DocumentAuth.PASSKEY) ?? false,
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
  const preCalculatedActionAuthOptions = useMemo(() => {
    if (
      !derivedRecipientActionAuth ||
      derivedRecipientActionAuth.length === 0 ||
      derivedRecipientActionAuth.includes(DocumentAuth.EXPLICIT_NONE)
    ) {
      return {
        type: DocumentAuth.EXPLICIT_NONE,
      };
    }

    if (
      derivedRecipientActionAuth.includes(DocumentAuth.ACCOUNT) &&
      user?.email == recipient.email
    ) {
      return {
        type: DocumentAuth.ACCOUNT,
      };
    }

    return null;
  }, [derivedRecipientActionAuth, user, recipient]);

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
      derivedRecipientActionAuth.length > 0 &&
      !derivedRecipientActionAuth.includes(DocumentAuth.EXPLICIT_NONE) &&
      user?.email !== recipient.email,
  );

  const refetchPasskeys = async () => {
    await passkeyQuery.refetch();
  };

  return (
    <DocumentSigningAuthContext.Provider
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
        isDirectTemplate,
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
        <DocumentSigningAuthDialog
          open={true}
          onOpenChange={() => setDocumentAuthDialogPayload(null)}
          onReauthFormSubmit={documentAuthDialogPayload.onReauthFormSubmit}
          actionTarget={documentAuthDialogPayload.actionTarget}
          availableAuthTypes={derivedRecipientActionAuth}
        />
      )}
    </DocumentSigningAuthContext.Provider>
  );
};

type ExecuteActionAuthProcedureOptions = Omit<
  DocumentSigningAuthDialogProps,
  'open' | 'onOpenChange' | 'documentAuthType' | 'recipientRole' | 'availableAuthTypes'
>;

DocumentSigningAuthProvider.displayName = 'DocumentSigningAuthProvider';
