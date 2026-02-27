import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

const mockFindUnique = vi.fn();

vi.mock('database', () => ({
  prisma: {
    pluginConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Mock ConnectionStatus — tested separately
vi.mock('../_components/connection-status', () => ({
  ConnectionStatus: ({ pluginName, initialState }: { pluginName: string; initialState: { connected: boolean } }) => (
    <div data-testid='connection-status' data-plugin={pluginName} data-connected={String(initialState.connected)} />
  ),
}));

// Mock SettingsForm — tested separately
vi.mock('../_components/settings-form', () => ({
  SettingsForm: ({
    pluginName,
    fields,
    currentValues,
    disabled,
  }: {
    pluginName: string;
    fields: unknown[];
    currentValues: Record<string, string>;
    disabled?: boolean;
  }) => (
    <form
      data-testid='settings-form'
      data-plugin={pluginName}
      data-fields={fields.length}
      data-values={JSON.stringify(currentValues)}
      data-disabled={String(disabled ?? false)}
    />
  ),
}));

// Mock the generated registry
vi.mock('@/generated/plugin-settings-registry', () => ({
  pluginSettingsRegistry: [
    {
      pluginName: 'discord',
      fields: [{ name: 'botToken', type: 'text', label: 'Bot Token', required: true, secret: true }],
    },
    {
      pluginName: 'context',
      fields: [{ name: 'apiKey', type: 'text', label: 'API Key', required: false, secret: false }],
    },
  ],
}));

const { default: PluginSettingsPage } = await import('../page');

describe('PluginSettingsPage', () => {
  it('calls notFound when plugin is not in registry', async () => {
    await expect(PluginSettingsPage({ params: Promise.resolve({ name: 'unknown-plugin' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('renders plugin name as heading', async () => {
    mockFindUnique.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).toContain('discord');
  });

  it('renders description text', async () => {
    mockFindUnique.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).toContain('Configure the discord plugin settings');
  });

  it('shows disabled warning when plugin config has enabled=false', async () => {
    mockFindUnique.mockResolvedValue({
      id: '1',
      pluginName: 'discord',
      enabled: false,
      metadata: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).toContain('disabled');
    expect(html).toContain('Settings are saved but will not take effect');
  });

  it('shows disabled warning when no plugin config exists (treated as disabled)', async () => {
    mockFindUnique.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    // null config means config?.enabled is undefined, !undefined = true — disabled warning shown
    expect(html).toContain('Settings are saved but will not take effect');
  });

  it('does not show disabled warning when plugin is enabled', async () => {
    mockFindUnique.mockResolvedValue({
      id: '1',
      pluginName: 'discord',
      enabled: true,
      metadata: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).not.toContain('Settings are saved but will not take effect');
  });

  it('masks secret fields in display values', async () => {
    mockFindUnique.mockResolvedValue({
      id: '1',
      pluginName: 'discord',
      enabled: true,
      metadata: null,
      settings: { botToken: 'my-secret-token' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    // Secret value should be masked, not passed as plain text
    expect(html).not.toContain('my-secret-token');
    // HTML-encoded form of the masked value in the data-values attribute
    expect(html).toContain('••••••••');
  });

  it('passes empty string for secret field with no stored value', async () => {
    mockFindUnique.mockResolvedValue({
      id: '1',
      pluginName: 'discord',
      enabled: true,
      metadata: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    // renderToStaticMarkup HTML-encodes attribute values — quotes become &quot;
    // The data-values JSON is: {"botToken":""} but encoded as {&quot;botToken&quot;:&quot;&quot;}
    expect(html).toContain('&quot;botToken&quot;:&quot;&quot;');
  });

  it('passes non-secret field values directly', async () => {
    mockFindUnique.mockResolvedValue({
      id: '1',
      pluginName: 'context',
      enabled: true,
      metadata: null,
      settings: { apiKey: 'my-api-key' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'context' }) }));
    expect(html).toContain('my-api-key');
  });

  it('renders SettingsForm with correct pluginName', async () => {
    mockFindUnique.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).toContain('data-plugin="discord"');
  });

  it('renders SettingsForm with correct field count', async () => {
    mockFindUnique.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));
    expect(html).toContain('data-fields="1"');
  });

  it('renders ConnectionStatus when PluginConfig metadata has connection field', async () => {
    mockFindUnique.mockResolvedValue({
      pluginName: 'discord',
      enabled: true,
      settings: null,
      metadata: { connection: { connected: true, username: 'HarnessBot#1234' } },
    });

    render(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));

    const status = screen.getByTestId('connection-status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('data-connected', 'true');
  });

  it('does not render ConnectionStatus when PluginConfig metadata has no connection field', async () => {
    mockFindUnique.mockResolvedValue({
      pluginName: 'discord',
      enabled: true,
      settings: null,
      metadata: null,
    });

    render(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));

    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();
  });
});
