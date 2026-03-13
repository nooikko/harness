import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../_components/profile-form', () => ({
  ProfileForm: ({ profile }: { profile: { name: string } }) => <div data-testid='profile-form' data-name={profile.name} />,
}));

vi.mock('../../_components/admin-breadcrumb', () => ({
  AdminBreadcrumb: () => <nav data-testid='breadcrumb'>Admin &gt; Profile</nav>,
}));

const { default: ProfilePage } = await import('../page');

describe('ProfilePage', () => {
  it('renders breadcrumb', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn', pronouns: null, age: null, gender: null, location: null, interests: null, bio: null });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="breadcrumb"');
  });

  it('renders page heading', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn', pronouns: null, age: null, gender: null, location: null, interests: null, bio: null });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Profile');
  });

  it('passes profile data to ProfileForm', async () => {
    mockFindUnique.mockResolvedValue({
      name: 'Quinn',
      pronouns: 'they/them',
      age: 28,
      gender: null,
      location: 'Phoenix',
      interests: null,
      bio: null,
    });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="profile-form"');
    expect(html).toContain('data-name="Quinn"');
  });

  it('uses default profile when none exists in DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-name="User"');
  });
});
