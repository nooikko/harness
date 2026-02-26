type ActivityChipsProps = {
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
};

type ActivityChipsComponent = (props: ActivityChipsProps) => React.ReactNode;

type FormatDuration = (ms: number) => string;

const formatDuration: FormatDuration = (ms) => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
};

type FormatModel = (model: string) => string;

const formatModel: FormatModel = (model) => {
  if (model.includes('opus')) {
    return 'Opus';
  }
  if (model.includes('sonnet')) {
    return 'Sonnet';
  }
  if (model.includes('haiku')) {
    return 'Haiku';
  }
  return model;
};

type ModelColor = (model: string) => string;

const modelColor: ModelColor = (model) => {
  if (model.includes('opus')) {
    return 'bg-purple-100 text-purple-700';
  }
  if (model.includes('sonnet')) {
    return 'bg-blue-100 text-blue-700';
  }
  if (model.includes('haiku')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-muted text-muted-foreground';
};

export const ActivityChips: ActivityChipsComponent = ({ model, inputTokens, outputTokens, durationMs }) => {
  if (!model && inputTokens === undefined && durationMs === undefined) {
    return null;
  }

  const totalTokens = inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined;

  return (
    <div className='mt-3 flex flex-wrap items-center gap-1.5'>
      {model && (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${modelColor(model)}`}>{formatModel(model)}</span>
      )}
      {totalTokens !== undefined && (
        <span className='inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
          {totalTokens.toLocaleString()} tokens
        </span>
      )}
      {durationMs !== undefined && (
        <span className='inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
          {formatDuration(durationMs)}
        </span>
      )}
    </div>
  );
};
