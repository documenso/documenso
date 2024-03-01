'use client';

import { useEffect, useState } from 'react';

import { FaGoogleDrive } from 'react-icons/fa';

import { Button } from '@documenso/ui/primitives/button';

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
type dropFunction = {
  onDrop?: (_file: File) => void | Promise<void>;
};

const GdrivePicker: React.FC<dropFunction> = ({ onDrop }) => {
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState(null);
  const [pickerInited, setPickerInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);

  const googleClientId = process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID ?? '';
  const googleApiKey = process.env.NEXT_PRIVATE_GOOGLE_API_KEY ?? '';

  function createPicker() {
    const showPicker = () => {
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.PDFS)
        .setMaxItems(1)
        .setOAuthToken(accessToken)
        .setDeveloperKey(googleApiKey)
        .setCallback(pickerCallback)
        .build();
      picker.setVisible(true);
    };

    tokenClient.callback = (response: any) => {
      if (response.error !== undefined) {
        throw response;
      }
      setAccessToken(response.access_token);
      showPicker();
    };

    if (accessToken === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  async function pickerCallback(data: any) {
    if (data[window.google.picker.Response.ACTION] == window.google.picker.Action.PICKED) {
      const doc = data[window.google.picker.Response.DOCUMENTS][0];
      const url = doc[window.google.picker.Document.URL];
      const name = doc[window.google.picker.Document.NAME];
      if (onDrop) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], name, { type: 'application/pdf' });
        void onDrop(file);
      }
    }
  }
  useEffect(() => {
    const onApiLoad = () => {
      window.gapi.load('picker', onPickerApiLoad);
    };
    const onPickerApiLoad = () => {
      setPickerInited(true);
    };

    const gisLoaded = () => {
      setTokenClient(
        window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: '',
        }),
      );
      setGisInited(true);
    };

    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.async = true;
    script1.defer = true;
    script1.onload = onApiLoad;

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.async = true;
    script2.defer = true;
    script2.onload = gisLoaded;

    document.body.appendChild(script1);
    document.body.appendChild(script2);

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script2);
    };
  }, [googleClientId]);

  return (
    <>
      {pickerInited && gisInited && (
        <Button
          variant="ghost"
          className="flex w-full justify-start"
          onClick={(e) => {
            e.stopPropagation();
            createPicker();
          }}
        >
          <div className="flex items-center gap-2">
            <FaGoogleDrive />
            Google Drive
          </div>
        </Button>
      )}
    </>
  );
};
export default GdrivePicker;
