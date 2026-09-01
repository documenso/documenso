export const renderCustomEmailTemplate = <T extends Record<string, string>>(template: string, variables: T): string => {
  // Match a run of non-brace, non-whitespace characters between braces. Using
  // `\S+` here was greedy across braces, so placeholders separated by a
  // non-whitespace character (e.g. "{day}/{month}/{year}") were captured as a
  // single bogus key and left unrendered.
  return template.replace(/\{([^\s{}]+)\}/g, (_, key) => {
    if (key in variables) {
      return variables[key];
    }

    return key;
  });
};
