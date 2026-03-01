'use client';

import { Button, Input, Label } from '@harness/ui';
import { useActionState } from 'react';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';
import { savePluginSettings } from '../_actions/save-plugin-settings';

type SettingsFormProps = {
  pluginName: string;
  fields: PluginSettingsField[];
  currentValues: Record<string, string>;
  disabled?: boolean;
};

type FormState = { success?: boolean; error?: string } | null;

export type BuildFormData = (fields: PluginSettingsField[], formData: FormData) => Record<string, string>;

export const buildFormData: BuildFormData = (fields, formData) => {
  const data: Record<string, string> = {};
  for (const field of fields) {
    data[field.name] = (formData.get(field.name) as string) ?? '';
  }
  return data;
};

type SettingsFormComponent = (props: SettingsFormProps) => React.ReactNode;

export const SettingsForm: SettingsFormComponent = ({ pluginName, fields, currentValues, disabled }) => {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const data = buildFormData(fields, formData);
    return savePluginSettings(pluginName, data);
  }, null);

  const hasRequired = fields.some((f) => f.required);

  return (
    <form action={formAction} className='space-y-6'>
      {hasRequired && (
        <div className='rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
          Fields marked with <span className='font-semibold'>*</span> are required for this plugin to function.
        </div>
      )}

      {state?.error && <div className='rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive'>{state.error}</div>}

      {state?.success && (
        <div className='rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800'>Settings saved successfully.</div>
      )}

      {fields.map((field) => (
        <div key={field.name} className='space-y-1.5'>
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className='ml-1 text-destructive'>*</span>}
          </Label>
          {field.description && <p className='text-sm text-muted-foreground'>{field.description}</p>}
          {field.type === 'select' && field.options ? (
            <select
              id={field.name}
              name={field.name}
              defaultValue={currentValues[field.name] ?? String(field.default ?? '')}
              disabled={disabled}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
