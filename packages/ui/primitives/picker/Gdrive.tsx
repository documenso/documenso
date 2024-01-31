'use client';

import React from 'react';

import useDrivePicker from 'react-google-drive-picker';
import { FaGoogleDrive } from 'react-icons/fa';

import { Button } from '@documenso/ui/primitives/button';

type dropFunction = {
  onDrop?: (_file: File) => void | Promise<void>;
};

const GdrivePicker: React.FC<dropFunction> = ({ onDrop }) => {
  const [openPicker] = useDrivePicker();

  const googleClientId = process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID ?? '';
  const googleApiKey = process.env.NEXT_PRIVATE_GOOGLE_API_KEY ?? '';

  const handlePickerOpen = () => {
    openPicker({
      clientId: googleClientId,
      developerKey: googleApiKey,
      viewId: 'PDFS',
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      callbackFunction: async (data) => {
        if (data.docs && onDrop) {
          const response = await fetch(data.docs[0].url);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const blob = await response.blob();
          const file = new File([blob], data.docs[0].name, { type: 'application/pdf' });
          void onDrop(file);
        }
      },
    });
  };

  return (
    <Button
      variant="ghost"
      className="flex w-full justify-start"
      onClick={(e) => {
        e.stopPropagation();
        handlePickerOpen();
      }}
    >
      <div className="flex items-center gap-2">
        <FaGoogleDrive />
        Google Drive
      </div>
    </Button>
  );
};
export default GdrivePicker;
