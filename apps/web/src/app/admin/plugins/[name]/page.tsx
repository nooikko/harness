import { prisma } from '@harness/database';
import { Card, CardContent, CardHeader, CardTitle } from '@harness/ui';
import { notFound } from 'next/navigation';
import { pluginSettingsRegistry } from '@/generated/plugin-settings-registry';
import { AdminBreadcrumb } from '../../_components/admin-breadcrumb';
import { SettingsForm } from './_components/settings-form';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ name: string }> };

type PluginSettingsPageComponent = (props: PageProps) => Promise<React.ReactNode>;

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

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb labels={{ [name]: name }} />
        <div>
          <h1 className='text-lg font-semibold capitalize tracking-tight'>{name}</h1>
          <p className='text-sm text-muted-foreground'>Configure the {name} plugin settings.</p>
          {!config?.enabled && (
            <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'>
              This plugin is currently <strong>disabled</strong>. Settings are saved but will not take effect until the plugin is enabled.
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='capitalize'>{name} Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm pluginName={name} fields={entry.fields} currentValues={displayValues} disabled={!config?.enabled} />
        </CardContent>
      </Card>
    </div>
  );
};

export default PluginSettingsPage;
