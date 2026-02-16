/**
 * Generates a unique identifier using three simple words.
 * Falls back to unix timestamp if word generation fails.
 */
export const generateId = (): string => {
  const adjectives = [
    'happy',
    'bright',
    'swift',
    'calm',
    'bold',
    'clever',
    'gentle',
    'quick',
    'sharp',
    'warm',
    'cool',
    'fresh',
    'solid',
    'clear',
    'sweet',
    'wild',
    'quiet',
    'loud',
    'smooth',
  ];

  const nouns = [
    'moon',
    'star',
    'ocean',
    'river',
    'forest',
    'mountain',
    'cloud',
    'wave',
    'stone',
    'flower',
    'bird',
    'wind',
    'light',
    'shadow',
    'fire',
    'earth',
    'sky',
    'tree',
    'leaf',
    'rock',
  ];

  const colors = [
    'blue',
    'red',
    'green',
    'yellow',
    'purple',
    'orange',
    'pink',
    'cyan',
    'amber',
    'emerald',
    'violet',
    'indigo',
    'coral',
    'teal',
    'gold',
    'silver',
    'copper',
    'bronze',
    'ivory',
    'jade',
  ];

  try {
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${randomAdjective}-${randomColor}-${randomNoun}`;
  } catch {
    // Fallback to unix timestamp if something goes wrong
    return Date.now().toString();
  }
};
