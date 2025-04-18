import { createContext, useContext } from 'react';

export type ConfigureDocumentContext = {
  // General
  isTemplate: boolean;
  isPersisted: boolean;
  // Features
  features: {
    allowConfigureSignatureTypes?: boolean;
    allowConfigureLanguage?: boolean;
    allowConfigureDateFormat?: boolean;
    allowConfigureTimezone?: boolean;
    allowConfigureRedirectUrl?: boolean;
    allowConfigureCommunication?: boolean;
  };
};

const ConfigureDocumentContext = createContext<ConfigureDocumentContext | null>(null);

export type ConfigureDocumentProviderProps = {
  isTemplate?: boolean;
  isPersisted?: boolean;
  features: {
    allowConfigureSignatureTypes?: boolean;
    allowConfigureLanguage?: boolean;
    allowConfigureDateFormat?: boolean;
    allowConfigureTimezone?: boolean;
    allowConfigureRedirectUrl?: boolean;
    allowConfigureCommunication?: boolean;
  };
  children: React.ReactNode;
};

export const ConfigureDocumentProvider = ({
  isTemplate,
  isPersisted,
  features,
  children,
}: ConfigureDocumentProviderProps) => {
  return (
    <ConfigureDocumentContext.Provider
      value={{
        isTemplate: isTemplate ?? false,
        isPersisted: isPersisted ?? false,
        features: {
          allowConfigureSignatureTypes: features.allowConfigureSignatureTypes ?? true,
          allowConfigureLanguage: features.allowConfigureLanguage ?? true,
          allowConfigureDateFormat: features.allowConfigureDateFormat ?? true,
          allowConfigureTimezone: features.allowConfigureTimezone ?? true,
          allowConfigureRedirectUrl: features.allowConfigureRedirectUrl ?? true,
          allowConfigureCommunication: features.allowConfigureCommunication ?? true,
        },
      }}
    >
      {children}
    </ConfigureDocumentContext.Provider>
  );
};

export const useConfigureDocument = () => {
  const context = useContext(ConfigureDocumentContext);

  if (!context) {
    throw new Error('useConfigureDocument must be used within a ConfigureDocumentProvider');
  }

  return context;
};
