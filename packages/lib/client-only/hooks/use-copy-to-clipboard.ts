import { useState } from 'react';

export type CopiedValue = string | null;
export type CopyFn = (_text: CopyValue, _blobType?: string) => Promise<boolean>;

type CopyValue = Promise<string> | string;

export function useCopyToClipboard(): [CopiedValue, CopyFn] {
  const [copiedText, setCopiedText] = useState<CopiedValue>(null);

  const copy: CopyFn = async (text, blobType = 'text/plain') => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    const isClipboardApiSupported = Boolean(typeof ClipboardItem && navigator.clipboard.write);

    // Try to save to clipboard then save it in the state if worked
    try {
      isClipboardApiSupported
        ? await handleClipboardApiCopy(text, blobType)
        : await handleWriteTextCopy(text);

      setCopiedText(await text);
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setCopiedText(null);
      return false;
    }
  };

  /**
   * Handle copying values to the clipboard using the ClipboardItem API.
   *
   * Works in all browsers except FireFox.
   *
   * https://caniuse.com/mdn-api_clipboarditem
   */
  const handleClipboardApiCopy = async (value: CopyValue, blobType = 'text/plain') => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blobType]: value })]);
    } catch (e) {
      // Fallback attempt.
      await handleWriteTextCopy(value);
    }
  };

  /**
   * Handle copying values to the clipboard using `writeText`.
   *
   * Works in all browsers except Safari for async values.
   */
  const handleWriteTextCopy = async (value: CopyValue) => {
    await navigator.clipboard.writeText(await value);
  };

  return [copiedText, copy];
}
