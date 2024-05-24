export type DownloadFileOptions = {
  filename: string;
  data: Blob;
};

export const downloadFile = ({ filename, data }: DownloadFileOptions) => {
  if (typeof window === 'undefined') {
    throw new Error('downloadFile can only be called in browser environments');
  }

  const link = window.document.createElement('a');

  link.href = window.URL.createObjectURL(data);
  link.download = filename;

  link.click();

  window.URL.revokeObjectURL(link.href);
};
