'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { FaDropbox } from 'react-icons/fa';

import { Button } from '../button';

type dropFunction = {
  onDrop?: (_file: File) => void | Promise<void>;
};

interface file {
  id: string;
  name: string;
  link: string;
  bytes: number;
  icon: string;
  thumbnailLink?: string;
  isDir: boolean;
}

interface options {
  success: (files: file[]) => void | Promise<void>;
  cancel?: () => void;
  multiselect?: boolean;
  linkType?: string;
  folderselect?: boolean;
  extensions?: string[];
  sizeLimit?: number[];
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Dropbox: any;
  }
}

const DropboxPicker: React.FC<dropFunction> = ({ onDrop }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Dropbox, setDropbox] = useState<any>();

  const options: options = {
    success: async (files: file[]) => {
      const response = await fetch(files[0].link);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const blob = await response.blob();
      const file = new File([blob], files[0].name, { type: 'application/pdf' });
      if (onDrop) {
        void onDrop(file);
      }
    },
    linkType: 'direct',
    multiselect: false,
    folderselect: false,
    extensions: ['.pdf'],
  };

  const handleChoose = useCallback(() => {
    if (Dropbox) {
      Dropbox.choose(options);
    }
  }, [Dropbox]);

  useEffect(() => {
    const handleScriptLoad = () => {
      setDropbox(window.Dropbox);
    };
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    script.id = process.env.NEXT_PRIVATE_DROPBOX_APP_KEY ?? '';
    script.async = true;
    script.onload = handleScriptLoad;

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        className="flex w-full justify-start"
        onClick={(e) => {
          e.stopPropagation();
          handleChoose();
        }}
      >
        <div className="flex items-center gap-2">
          <FaDropbox />
          Dropbox
        </div>
      </Button>
    </>
  );
};
export default DropboxPicker;
