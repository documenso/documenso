/**
 * Utility functions for detecting text that requires specific fonts
 */

/**
 * Detects if text contains Thai characters
 * Thai Unicode range: U+0E00-U+0E7F
 */
export const containsThaiCharacters = (text: string): boolean => {
  if (!text) return false;

  // Thai Unicode block: U+0E00-U+0E7F
  const thaiRegex = /[\u0E00-\u0E7F]/;
  return thaiRegex.test(text);
};

/**
 * Detects if text contains characters that require special font handling
 * Currently supports Thai language detection
 */
export const requiresSpecialFont = (text: string): 'thai' | 'default' => {
  if (containsThaiCharacters(text)) {
    return 'thai';
  }

  return 'default';
};

/**
 * Gets the appropriate font type based on text content
 */
export const getFontTypeForText = (text: string, isSignatureField: boolean = false): 'handwriting' | 'thai' | 'standard' => {
  if (isSignatureField) {
    return 'handwriting';
  }

  if (containsThaiCharacters(text)) {
    return 'thai';
  }

  return 'standard';
};