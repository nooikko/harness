type FormatRecurrence = (recurrenceJson: string | null) => string | null;

const formatRecurrence: FormatRecurrence = (recurrenceJson) => {
  if (!recurrenceJson) {
    return null;
  }
  try {
    const rec = JSON.parse(recurrenceJson) as {
      pattern?: { type?: string; interval?: number; daysOfWeek?: string[]; dayOfMonth?: number };
      range?: { type?: string; startDate?: string; endDate?: string };
    };
    const pattern = rec.pattern;
    if (!pattern?.type) {
      return null;
    }

    switch (pattern.type) {
      case 'daily':
        return pattern.interval === 1 ? 'Daily' : `Every ${pattern.interval} days`;
      case 'weekly': {
        const days = pattern.daysOfWeek?.join(', ') ?? '';
        return pattern.interval === 1 ? `Weekly on ${days}` : `Every ${pattern.interval} weeks on ${days}`;
      }
      case 'absoluteMonthly':
        return pattern.interval === 1 ? `Monthly on day ${pattern.dayOfMonth}` : `Every ${pattern.interval} months on day ${pattern.dayOfMonth}`;
      case 'relativeMonthly':
        return 'Monthly';
      case 'absoluteYearly':
        return 'Yearly';
      default:
        return pattern.type;
    }
  } catch {
    return null;
  }
};

export { formatRecurrence };
