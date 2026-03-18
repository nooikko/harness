export type Verdict = 'pass' | 'fail' | 'unknown';

type ParseVerdict = (response: string) => { verdict: Verdict; feedback: string };

export const parseVerdict: ParseVerdict = (response) => {
  // Match the LAST "VERDICT: PASS/FAIL" in the response to avoid false positives
  // from earlier explanation text (e.g., "The format is VERDICT: PASS or VERDICT: FAIL")
  const allMatches = [...response.matchAll(/VERDICT:\s*(PASS|FAIL)/gi)];
  const lastMatch = allMatches.at(-1);

  if (!lastMatch) {
    return { verdict: 'unknown', feedback: '' };
  }

  const verdictValue = lastMatch[1]!.toUpperCase();

  if (verdictValue === 'PASS') {
    return { verdict: 'pass', feedback: '' };
  }

  // Extract feedback: everything after the last VERDICT: FAIL
  const afterVerdict = response.slice(lastMatch.index! + lastMatch[0].length).trim();
  return { verdict: 'fail', feedback: afterVerdict || 'Validation failed without specific feedback.' };
};
