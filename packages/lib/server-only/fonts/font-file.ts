import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import fontkit from '@pdf-lib/fontkit';

export const SUPPORTED_FONT_MIME_TYPES = ['font/ttf', 'font/otf', 'application/x-font-ttf', 'application/x-font-otf'];
export const SUPPORTED_FONT_EXTENSIONS = ['.ttf', '.otf'];
export const MAX_FONT_FILE_SIZE = 5 * 1024 * 1024;

export type ParsedFontFile = {
  name: string;
  family: string;
};

export const parseFontFile = ({ bytes, fallbackName }: { bytes: Uint8Array; fallbackName: string }): ParsedFontFile => {
  try {
    const font = fontkit.create(bytes);
    const family = font.familyName || font.postscriptName || fallbackName.replace(/\.[^.]+$/, '');

    return {
      name: font.fullName || family,
      family,
    };
  } catch (_err) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid font file',
    });
  }
};

export const isSupportedFontFileName = (fileName: string) => {
  const lowerFileName = fileName.toLowerCase();

  return SUPPORTED_FONT_EXTENSIONS.some((extension) => lowerFileName.endsWith(extension));
};

export const isSupportedFontMimeType = (mimeType: string | undefined | null) => {
  if (!mimeType) {
    return true;
  }

  return SUPPORTED_FONT_MIME_TYPES.includes(mimeType);
};

export const inferFontMimeType = (fileName: string) => {
  return fileName.toLowerCase().endsWith('.otf') ? 'font/otf' : 'font/ttf';
};
