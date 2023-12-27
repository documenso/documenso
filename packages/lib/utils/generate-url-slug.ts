const diacriticRegex = /\p{Diacritic}/gu;
const nonAlphanumericRegex = /[^.\p{L}\p{N}\p{Zs}\p{Emoji}]+/gu;
const whitespaceUnderscoreRegex = /[\s_#]+/g;
const dashStartRegex = /^-+/;
const multipleDotsRegex = /\.{2,}/g;

export const generateURLSlug = (str: string, forDisplayingInput?: boolean) => {
  if (!str) {
    return '';
  }

  const slug = str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(diacriticRegex, '')
    .replace(nonAlphanumericRegex, '-')
    .replace(whitespaceUnderscoreRegex, '-')
    .replace(dashStartRegex, '') // Remove dashes from start
    .replace(multipleDotsRegex, '.'); // Replace consecutive periods with a single period

  return forDisplayingInput ? slug : slug.replace(/-*$/g, ''); // Remove dashes from end
};

export default generateURLSlug;
