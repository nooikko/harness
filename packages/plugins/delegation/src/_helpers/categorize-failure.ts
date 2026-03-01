// Categorizes a sub-agent invocation failure to drive circuit breaker behavior.
// Logic errors (parse/schema failures) should fast-fail; timeouts/crashes should back off.

export type FailureCategory = 'timeout' | 'crash' | 'logic-error' | 'unknown';

type CategorizeFailure = (error: string | undefined) => FailureCategory;

export const categorizeFailure: CategorizeFailure = (error) => {
  if (!error) {
    return 'unknown';
  }

  const e = error.toLowerCase();

  if (e.includes('timed out') || e.includes('timeout')) {
    return 'timeout';
  }
  if (e.includes('json') || e.includes('parse') || e.includes('invalid tool')) {
    return 'logic-error';
  }
  if (e.includes('memory') || e.includes('limit exceeded')) {
    return 'logic-error';
  }
  if (e.includes('crash') || e.includes('killed') || e.includes('abort')) {
    return 'crash';
  }

  return 'unknown';
};
