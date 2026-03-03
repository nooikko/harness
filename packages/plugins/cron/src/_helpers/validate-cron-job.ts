// validate-cron-job — determines whether a CronJob is recurring, one-shot, or invalid

type CronJobLike = {
  schedule: string | null;
  fireAt: Date | null;
};

type ValidationResult = {
  valid: boolean;
  type: 'recurring' | 'one-shot' | 'invalid';
  reason?: string;
};

type ValidateCronJob = (job: CronJobLike) => ValidationResult;

export const validateCronJob: ValidateCronJob = (job) => {
  const hasSchedule = job.schedule !== null;
  const hasFireAt = job.fireAt !== null;

  if (hasSchedule && hasFireAt) {
    return {
      valid: false,
      type: 'invalid',
      reason: 'Job has both schedule and fireAt set — must be one or the other',
    };
  }

  if (!hasSchedule && !hasFireAt) {
    return {
      valid: false,
      type: 'invalid',
      reason: 'Job has neither schedule nor fireAt set',
    };
  }

  if (hasSchedule) {
    return { valid: true, type: 'recurring' };
  }

  return { valid: true, type: 'one-shot' };
};
