import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import { pluginSettingsRegistry } from '@/generated/plugin-settings-registry';
import { ConnectionStatus } from './_components/connection-status';
import { SettingsForm } from './_components/settings-form';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ name: string }> };

type PluginSettingsPageComponent = (props: PageProps) => Promise<React.ReactNode>;

type PluginConnectionState = {
  connected: boolean;
  username?: string;
};

type PluginMetadata = {
  connection?: PluginConnectionState;
};

const PluginSettingsPage: PluginSettingsPageComponent = async ({ params }) => {
  const { name } = await params;

  const entry = pluginSettingsRegistry.find((e) => e.pluginName === name);
  if (!entry) {
    notFound();
  }

  const config = await prisma.pluginConfig.findUnique({ where: { pluginName: name } });
  const rawSettings = (config?.settings ?? {}) as Record<string, string>;

  // Mask secret field values — never send decrypted data to the browser
  const displayValues: Record<string, string> = {};
  for (const field of entry.fields) {
    if (field.secret) {
      displayValues[field.name] = rawSettings[field.name] ? '••••••••' : '';
    } else {
      displayValues[field.name] = rawSettings[field.name] ?? '';
    }
  }

  const metadata = (config?.metadata ?? null) as PluginMetadata | null;

  return (
    <div className='max-w-xl space-y-6 p-6'>
      <div>
        <h2 className='text-2xl font-semibold capitalize'>{name}</h2>
        <p className='mt-1 text-muted-foreground'>Configure the {name} plugin settings.</p>
        {!config?.enabled && (
          <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
            This plugin is currently <strong>disabled</strong>. Settings are saved but will not take effect until the plugin is enabled.
          </div>
        )}
      </div>

      {metadata?.connection !== undefined && <ConnectionStatus pluginName={name} initialState={metadata.connection ?? { connected: false }} />}

      <SettingsForm pluginName={name} fields={entry.fields} currentValues={displayValues} disabled={!config?.enabled} />
    </div>
  );
};

export default PluginSettingsPage;
