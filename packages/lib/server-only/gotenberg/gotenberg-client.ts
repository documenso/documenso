import { getGotenbergTimeout, getGotenbergUrl } from '../../constants/upload';
import { AppError } from '../../errors/app-error';

export type ConvertFileToPdfOptions = {
  file: Buffer;
  filename: string;
  mimeType: string;
};

export const convertFileToPdfViaGotenberg = async ({
  file,
  filename,
  mimeType,
}: ConvertFileToPdfOptions): Promise<Buffer> => {
  const gotenbergUrl = getGotenbergUrl();

  if (!gotenbergUrl) {
    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: 'Gotenberg URL is not configured',
      userMessage: 'File conversion service is not available. Please upload a PDF file instead.',
      statusCode: 503,
    });
  }

  const formData = new FormData();
  const blob = new Blob([file], { type: mimeType });
  formData.append('files', blob, filename);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getGotenbergTimeout());

  try {
    const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');

      console.error(`Gotenberg conversion failed: ${response.status} - ${errorText}`);

      throw new AppError('CONVERSION_FAILED', {
        message: `Gotenberg returned status ${response.status}: ${errorText}`,
        userMessage:
          'Failed to convert the file to PDF. Please try again or upload a PDF file instead.',
        statusCode: 400,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
        message: 'Gotenberg request timed out',
        userMessage:
          'File conversion timed out. Please try again with a smaller file or upload a PDF instead.',
        statusCode: 503,
      });
    }

    console.error('Gotenberg conversion error:', error);

    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: `Failed to reach Gotenberg: ${error instanceof Error ? error.message : 'Unknown error'}`,
      userMessage:
        'File conversion service is temporarily unavailable. Please upload a PDF file instead.',
      statusCode: 503,
    });
  }
};
