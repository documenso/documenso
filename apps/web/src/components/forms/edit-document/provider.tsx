import React, { createContext, useRef } from 'react';

import { OnPDFViewerPageClick } from '~/components/(dashboard)/pdf-viewer/pdf-viewer';

type EditFormContextValue = {
  firePageClickEvent: OnPDFViewerPageClick;
  registerPageClickHandler: (_handler: OnPDFViewerPageClick) => void;
  unregisterPageClickHandler: (_handler: OnPDFViewerPageClick) => void;
} | null;

const EditFormContext = createContext<EditFormContextValue>(null);

export type EditFormProviderProps = {
  children: React.ReactNode;
};

export const useEditForm = () => {
  const context = React.useContext(EditFormContext);

  if (!context) {
    throw new Error('useEditForm must be used within a EditFormProvider');
  }

  return context;
};

export const EditFormProvider = ({ children }: EditFormProviderProps) => {
  const handlers = useRef(new Set<OnPDFViewerPageClick>());

  const firePageClickEvent: OnPDFViewerPageClick = (event) => {
    handlers.current.forEach((handler) => handler(event));
  };

  const registerPageClickHandler = (handler: OnPDFViewerPageClick) => {
    handlers.current.add(handler);
  };

  const unregisterPageClickHandler = (handler: OnPDFViewerPageClick) => {
    handlers.current.delete(handler);
  };

  return (
    <EditFormContext.Provider
      value={{
        firePageClickEvent,
        registerPageClickHandler,
        unregisterPageClickHandler,
      }}
    >
      {children}
    </EditFormContext.Provider>
  );
};
