import { prisma } from '@harness/database';
import { Separator } from '@harness/ui';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';
import { pluginSettingsRegistry } from '@/generated/plugin-settings-registry';
import { AdminBreadcrumb } from '../../_components/admin-breadcrumb';
import { SettingsForm } from '../[name]/_components/settings-form';
import { CastDeviceList } from './_components/cast-device-list';
import { YouTubeAccountSection } from './_components/youtube-account-section';

export const dynamic = 'force-dynamic';

type OAuthCredentials = {
  authMethod?: string;
  accessToken?: string;
  accountEmail?: string;
  accountName?: string;
  accountPhoto?: string;
  providerMeta?: Record<string, unknown>;
};

type MusicPluginPageComponent = () => Promise<React.ReactNode>;

const MusicPluginPage: MusicPluginPageComponent = async () => {
  const config = await prisma.pluginConfig.findUnique({
    where: { pluginName: 'music' },
  });
  const rawSettings = (config?.settings ?? {}) as Record<string, unknown>;

  // Extract OAuth connection status from stored credentials
  const youtubeAuth = rawSettings.youtubeAuth as OAuthCredentials | undefined;
  const connected = !!youtubeAuth?.accessToken || youtubeAuth?.authMethod === 'cookie';
  const account = connected
    ? {
        email: youtubeAuth?.accountEmail,
        name: youtubeAuth?.accountName,
        photo: youtubeAuth?.accountPhoto,
        subscriptionTier: (youtubeAuth?.providerMeta?.subscriptionTier as string) ?? undefined,
      }
    : undefined;

  // Build display values for the SettingsForm (scalar fields only)
  const entry = pluginSettingsRegistry.find((e) => e.pluginName === 'music');
  const fields = entry?.fields ?? [];
  const displayValues: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'oauth') {
      continue;
    }
    const raw = rawSettings[field.name];
    if (field.secret) {
      displayValues[field.name] = raw ? '••••••••' : '';
    } else {
      displayValues[field.name] = raw !== undefined ? String(raw) : '';
    }
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb labels={{ music: 'Music' }} />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Music Plugin</h1>
          <p className='text-sm text-muted-foreground'>YouTube Music playback via Cast devices.</p>
          {!config?.enabled && (
            <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'>
              This plugin is currently <strong>disabled</strong>. Settings are saved but will not take effect until the plugin is enabled.
            </div>
          )}
        </div>
      </div>

      <Separator />

      <YouTubeAccountSection connected={connected} account={account} orchestratorUrl={getOrchestratorUrl()} />

      <Separator />

      <CastDeviceList orchestratorUrl={getOrchestratorUrl()} />

      <Separator />

      <div className='max-w-xl space-y-4'>
        <h3 className='text-sm font-medium'>Playback Settings</h3>
        <SettingsForm pluginName='music' fields={fields} currentValues={displayValues} disabled={!config?.enabled} />
      </div>
    </div>
  );
};

export default MusicPluginPage;
