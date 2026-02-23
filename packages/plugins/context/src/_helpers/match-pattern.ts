// Converts glob-like patterns to regex and tests file paths against them
// Supports * (any chars except /), ** (any depth), ? (single char)

type PatternToRegex = (pattern: string) => RegExp;

const patternToRegex: PatternToRegex = (pattern) => {
  let regexStr = '^';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*' && pattern[i + 1] === '*') {
      // ** matches any depth including path separators
      if (pattern[i + 2] === '/') {
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // * matches any characters except /
      regexStr += '[^/]*';
      i += 1;
    } else if (char === '?') {
      // ? matches a single character except /
      regexStr += '[^/]';
      i += 1;
    } else if (char === '.') {
      regexStr += '\\.';
      i += 1;
    } else {
      regexStr += char;
      i += 1;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
};

type MatchPattern = (filePath: string, pattern: string) => boolean;

export const matchPattern: MatchPattern = (filePath, pattern) => {
  const regex = patternToRegex(pattern);
  return regex.test(filePath);
};
