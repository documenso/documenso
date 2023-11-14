export const generateTwitterIntent = (text: string, shareUrl: string) => {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}%0A%0A${encodeURIComponent(shareUrl)}`;
};
