import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';

const mockSavePluginSettings = vi.fn();

// Mock the server action — it's a server-only module
vi.mock('../_actions/save-plugin-settings', () => ({
  savePluginSettings: mockSavePluginSettings,
}));

const { SettingsForm, buildFormData } = await import('../settings-form');

const textField: PluginSettingsField = {
  name: 'apiKey',
  label: 'API Key',
  type: 'text',
  required: true,
  secret: false,
  description: 'Your API key',
};

const secretField: PluginSettingsField = {
  name: 'secret',
  label: 'Secret',
  type: 'text',
  required: false,
  secret: true,
};

const numberField: PluginSettingsField = {
  name: 'timeout',
  label: 'Timeout',
  type: 'number',
  required: false,
  secret: false,
  default: 30,
};

const selectField: PluginSettingsField = {
  name: 'model',
  label: 'Model',
  type: 'select',
  required: false,
  secret: false,
  options: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5', label: 'GPT-3.5' },
  ],
  default: 'gpt-4',
};

describe('buildFormData', () => {
  it('extracts field values from FormData', () => {
    const formData = new FormData();
    formData.set('apiKey', 'test-key');
    const result = buildFormData([textField], formData);
    expect(result).toEqual({ apiKey: 'test-key' });
  });

  it('falls back to empty string for missing FormData values', () => {
    const formData = new FormData();
    const result = buildFormData([textField], formData);
    expect(result).toEqual({ apiKey: '' });
  });

  it('extracts multiple fields', () => {
    const formData = new FormData();
    formData.set('apiKey', 'key-value');
    formData.set('secret', 'secret-value');
    const result = buildFormData([textField, secretField], formData);
    expect(result).toEqual({ apiKey: 'key-value', secret: 'secret-value' });
  });
});

describe('SettingsForm', () => {
  it('renders field labels', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    expect(screen.getByLabelText(/api key/i)).toBeDefined();
  });

  it('shows required asterisk for required fields', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    // The label contains "*" as a required marker — banner also has * so use getAllByText
    const asterisks = screen.getAllByText('*');
    expect(asterisks.length).toBeGreaterThan(0);
  });

  it('shows required fields notice banner when fields have required=true', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    expect(screen.getByText(/fields marked with/i)).toBeDefined();
  });

  it('does not show required banner when no required fields', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[secretField]} currentValues={{}} />);
    expect(screen.queryByText(/fields marked with/i)).toBeNull();
  });

  it('renders secret field as password input', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[secretField]} currentValues={{}} />);
    const input = screen.getByLabelText(/secret/i) as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('renders number field as number input', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[numberField]} currentValues={{}} />);
    const input = screen.getByLabelText(/timeout/i) as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('uses default value when no current value for number field', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[numberField]} currentValues={{}} />);
    const input = screen.getByLabelText(/timeout/i) as HTMLInputElement;
    expect(input.value).toBe('30');
  });

  it('renders select field with options', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[selectField]} currentValues={{}} />);
    expect(screen.getByRole('combobox')).toBeDefined();
    expect(screen.getByText('GPT-4')).toBeDefined();
    expect(screen.getByText('GPT-3.5')).toBeDefined();
  });

  it('uses current value for select field when provided', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[selectField]} currentValues={{ model: 'gpt-3.5' }} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('gpt-3.5');
  });

  it('uses default value for select field when no current value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[selectField]} currentValues={{}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('gpt-4');
  });

  it('disables select field when disabled prop is true', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[selectField]} currentValues={{}} disabled />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('disables all inputs when disabled prop is true', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} disabled />);
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    const btn = screen.getByRole('button', { name: /save settings/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders field description when provided', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    expect(screen.getByText('Your API key')).toBeDefined();
  });

  it('pre-populates non-secret field with current value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{ apiKey: 'my-api-key' }} />);
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    expect(input.value).toBe('my-api-key');
  });

  it('leaves secret field empty regardless of current value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[secretField]} currentValues={{ secret: 'stored-secret' }} />);
    const input = screen.getByLabelText(/secret/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('shows placeholder for secret field with existing value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[secretField]} currentValues={{ secret: 'stored-secret' }} />);
    const input = screen.getByLabelText(/secret/i) as HTMLInputElement;
    expect(input.placeholder).toBe('••••••••');
  });

  it('renders save button', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    expect(screen.getByRole('button', { name: /save settings/i })).toBeDefined();
  });

  it('applies destructive border class when required field has no value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{}} />);
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    // When required field is empty, the form adds 'border-destructive' class directly
    expect(input.className.split(' ')).toContain('border-destructive');
  });

  it('does not add explicit border-destructive class when required field has a value', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField]} currentValues={{ apiKey: 'some-value' }} />);
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    // className should not have 'border-destructive' as a standalone class
    expect(input.className.split(' ')).not.toContain('border-destructive');
  });

  it('renders multiple fields', () => {
    render(<SettingsForm pluginName='test-plugin' fields={[textField, secretField, selectField]} currentValues={{}} />);
    expect(screen.getByLabelText(/api key/i)).toBeDefined();
    expect(screen.getByLabelText(/secret/i)).toBeDefined();
    expect(screen.getByRole('combobox')).toBeDefined();
  });
});
