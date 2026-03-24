type EffortOption = { value: string; label: string };

type GetEffortOptions = (model: string | null) => EffortOption[];

export const getEffortOptions: GetEffortOptions = (model) => {
  const isHaiku = model?.includes('haiku') ?? false;
  const isSonnet = model?.includes('sonnet') ?? false;
  const isOpus = model?.includes('opus') ?? false;

  const defaultLabel = isHaiku ? 'Default (Off)' : isSonnet ? 'Default (Medium)' : isOpus ? 'Default (High)' : 'Default';

  const options: EffortOption[] = [{ value: '', label: defaultLabel }];

  options.push({ value: 'off', label: 'Off' });
  options.push({ value: 'low', label: 'Low' });

  if (!isHaiku) {
    options.push({ value: 'medium', label: 'Medium' });
    options.push({ value: 'high', label: 'High' });
  }

  if (isOpus || (!isHaiku && !isSonnet && !isOpus)) {
    options.push({ value: 'max', label: 'Max' });
  }

  return options;
};
