'use client';

import { Alert, AlertDescription, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@harness/ui';
import { useActionState, useCallback, useEffect, useState } from 'react';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';
import { savePluginSettings } from '../_actions/save-plugin-settings';

type SettingsFormProps = {
  pluginName: string;
  fields: PluginSettingsField[];
  currentValues: Record<string, string>;
  disabled?: boolean;
  orchestratorUrl?: string;
};

type FormState = { success?: boolean; error?: string } | null;

export type BuildFormData = (fields: PluginSettingsField[], formData: FormData) => Record<string, string>;

export const buildFormData: BuildFormData = (fields, formData) => {
  const data: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'oauth') {
      continue;
    }
    data[field.name] = (formData.get(field.name) as string) ?? '';
  }
  return data;
};

// --- Dynamic select component ---

type SelectOption = { label: string; value: string };

type DynamicSelectProps = {
  field: PluginSettingsField;
  defaultValue: string;
  disabled?: boolean;
  orchestratorUrl?: string;
};

type DynamicSelectComponent = (props: DynamicSelectProps) => React.ReactNode;

const DynamicSelect: DynamicSelectComponent = ({ field, defaultValue, disabled, orchestratorUrl }) => {
  const staticOptions = field.options ?? [];
  const [options, setOptions] = useState<SelectOption[]>(staticOptions);

  const fetchUrl = field.fetchOptionsUrl;

  const loadOptions = useCallback(async () => {
    if (!fetchUrl || !orchestratorUrl) {
      return;
    }
    try {
      const res = await fetch(`${orchestratorUrl}${fetchUrl}`);
      if (res.ok) {
        const data = (await res.json()) as { options?: SelectOption[] };
        if (data.options && data.options.length > 0) {
          setOptions(data.options);
        }
      }
    } catch {
      // Fall back to static options
    }
  }, [fetchUrl, orchestratorUrl]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  return (
    <Select name={field.name} defaultValue={defaultValue} disabled={disabled}>
      <SelectTrigger id={field.name}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// --- Main form ---

type SettingsFormComponent = (props: SettingsFormProps) => React.ReactNode;

export const SettingsForm: SettingsFormComponent = ({ pluginName, fields, currentValues, disabled, orchestratorUrl }) => {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const data = buildFormData(fields, formData);
    return savePluginSettings(pluginName, data);
  }, null);

  const hasRequired = fields.some((f) => f.required);

  return (
    <form action={formAction} className='space-y-6'>
      {hasRequired && (
        <Alert>
          <AlertDescription>
            Fields marked with <span className='font-semibold'>*</span> are required for this plugin to function.
          </AlertDescription>
        </Alert>
      )}

      {state?.error && (
        <Alert variant='destructive'>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && (
        <Alert>
          <AlertDescription>Settings saved successfully.</AlertDescription>
        </Alert>
      )}

      {fields
        .filter((field) => field.type !== 'oauth')
        .map((field) => (
          <div key={field.name} className='space-y-1.5'>
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className='ml-1 text-destructive'>*</span>}
            </Label>
            {field.description && <p className='text-sm text-muted-foreground'>{field.description}</p>}
            {field.type === 'select' && (field.options || field.fetchOptionsUrl) ? (
              <DynamicSelect
                field={field}
                defaultValue={currentValues[field.name] ?? String(field.default ?? '')}
                disabled={disabled}
                orchestratorUrl={orchestratorUrl}
              />
            ) : (
              <Input
                id={field.name}
                name={field.name}
                type={field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'}
                defaultValue={field.secret ? '' : (currentValues[field.name] ?? String(field.default ?? ''))}
                placeholder={field.secret && currentValues[field.name] ? '••••••••' : undefined}
                disabled={disabled}
                className={field.required && !currentValues[field.name] ? 'border-destructive' : ''}
              />
            )}
          </div>
        ))}

      <Button type='submit' disabled={disabled || isPending}>
        {isPending ? 'Saving…' : 'Save Settings'}
      </Button>
    </form>
  );
};
