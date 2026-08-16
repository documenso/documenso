export const renderCustomEmailTemplate = <T extends Record<string, string>>(template: string, variables: T): string => {
  // Exclude braces (and whitespace) from the key so that adjacent placeholders
  // like "{first}{last}" or "{a}-{b}" are matched individually. A greedy "\S+"
  // would otherwise span from the first "{" to the last "}" and corrupt the output.
  return template.replace(/\{([^{}\s]+)\}/g, (_, key) => {
    if (key in variables) {
      return variables[key];
    }

    return key;
  });
};
