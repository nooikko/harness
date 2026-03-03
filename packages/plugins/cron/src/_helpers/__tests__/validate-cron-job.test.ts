import { describe, expect, it } from 'vitest';
import { validateCronJob } from '../validate-cron-job';

describe('validateCronJob', () => {
  it('returns recurring for a job with schedule and no fireAt', () => {
    const result = validateCronJob({ schedule: '0 9 * * *', fireAt: null });

    expect(result).toEqual({ valid: true, type: 'recurring' });
  });

  it('returns one-shot for a job with fireAt and no schedule', () => {
    const result = validateCronJob({
      schedule: null,
      fireAt: new Date('2099-01-01T00:00:00Z'),
    });

    expect(result).toEqual({ valid: true, type: 'one-shot' });
  });

  it('returns invalid when both schedule and fireAt are null', () => {
    const result = validateCronJob({ schedule: null, fireAt: null });

    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
    expect(result.reason).toContain('neither');
  });

  it('returns invalid when both schedule and fireAt are set', () => {
    const result = validateCronJob({
      schedule: '0 9 * * *',
      fireAt: new Date('2099-01-01T00:00:00Z'),
    });

    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
    expect(result.reason).toContain('both');
  });

  it('treats any non-null schedule string as valid recurring', () => {
    const result = validateCronJob({ schedule: '*/5 * * * *', fireAt: null });

    expect(result).toEqual({ valid: true, type: 'recurring' });
  });

  it('treats any non-null fireAt date as valid one-shot', () => {
    const result = validateCronJob({
      schedule: null,
      fireAt: new Date('2020-01-01T00:00:00Z'),
    });

    expect(result).toEqual({ valid: true, type: 'one-shot' });
  });
});
