type CronJobDefinition = {
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
};

type GetCronJobDefinitions = () => CronJobDefinition[];

export const getCronJobDefinitions: GetCronJobDefinitions = () => [
  {
    name: 'Morning Digest',
    schedule: '0 14 * * *',
    prompt: [
      'Run the morning digest routine:',
      "1. Check today's calendar events using the Graph calendar tools.",
      '2. Check recent and flagged emails using the Graph mail tools.',
      "3. Update context/world-state.md with today's schedule, pending emails, and any urgent items.",
      '4. Post a concise morning briefing to the primary thread summarizing:',
      "   - Today's meetings (times in MST)",
      '   - Action items from recent emails',
      '   - Any scheduling conflicts or urgent items requiring attention',
      'Keep the briefing under 500 words. Be direct and actionable.',
    ].join('\n'),
    enabled: true,
  },
  {
    name: 'Memory Consolidation',
    schedule: '0 8 * * *',
    prompt: [
      'Run the nightly memory consolidation routine:',
      "1. Read context/inbox.md for today's observations and notes.",
      '2. Read context/memory.md for existing long-term memory.',
      '3. Merge important items from inbox.md into memory.md:',
      '   - Keep memory.md under 100 lines.',
      '   - Prioritize actionable information, user preferences, and project context.',
      '   - Discard transient observations that are no longer relevant.',
      '4. Clear context/inbox.md after successful consolidation.',
      '5. Update context/thread-summaries.md with any notable thread activity.',
      'Be aggressive about pruning — memory.md should contain only information',
      'that will be useful for future interactions.',
    ].join('\n'),
    enabled: true,
  },
  {
    name: 'Calendar Email Refresh',
    schedule: '*/30 * * * *',
    prompt: [
      'Run a quick calendar and email refresh:',
      '1. Check calendar for events in the next 2 hours.',
      '2. Check for new urgent or flagged emails since the last refresh.',
      '3. Update context/world-state.md with any changes.',
      '4. If there is a meeting starting within 30 minutes, post a reminder to the primary thread.',
      '5. If there is an urgent email (flagged or from a VIP), alert the primary thread.',
      'Only post alerts when there is something actionable. Do not post if nothing has changed.',
    ].join('\n'),
    enabled: true,
  },
  {
    name: 'Weekly Review',
    schedule: '0 0 * * 6',
    prompt: [
      'Run the weekly review routine:',
      '1. Review all completed tasks from the past week.',
      '2. Review all thread activity and summarize key outcomes.',
      '3. Check context/memory.md and context/inbox.md for recurring themes.',
      '4. Post a weekly summary to the primary thread covering:',
      '   - Tasks completed and their outcomes',
      '   - Key decisions made',
      '   - Patterns or recurring requests to note',
      '   - Suggestions for the upcoming week',
      '5. Update context/memory.md with any weekly insights worth preserving.',
      'Keep the summary concise but comprehensive. Focus on outcomes and learnings.',
    ].join('\n'),
    enabled: true,
  },
];
