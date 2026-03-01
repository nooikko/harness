export type Verdict = 'pass' | 'fail' | 'unknown';

type ParseVerdict = (response: string) => { verdict: Verdict; feedback: string };

export const parseVerdict: ParseVerdict = (response) => {
  const passMatch = /VERDICT:\s*PASS/i.test(response);
  const failMatch = /VERDICT:\s*FAIL/i.test(response);

  if (passMatch) {
    return { verdict: 'pass', feedback: '' };
  }

  if (failMatch) {
    // Extract feedback: everything after "VERDICT: FAIL"
    const afterVerdict = response.replace(/.*VERDICT:\s*FAIL/is, '').trim();
    return { verdict: 'fail', feedback: afterVerdict || 'Validation failed without specific feedback.' };
  }

  return { verdict: 'unknown', feedback: '' };
};
