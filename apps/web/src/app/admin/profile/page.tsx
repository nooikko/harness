import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { AdminBreadcrumb } from '../_components/admin-breadcrumb';
import { ProfileForm } from './_components/profile-form';

export const metadata: Metadata = {
  title: 'Profile | Admin | Harness Dashboard',
};

type ProfilePageComponent = () => Promise<React.ReactNode>;

const ProfilePage: ProfilePageComponent = async () => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
    select: {
      name: true,
      pronouns: true,
      age: true,
      gender: true,
      location: true,
      interests: true,
      bio: true,
    },
  });

  const data = profile ?? {
    name: 'User',
    pronouns: null,
    age: null,
    gender: null,
    location: null,
    interests: null,
    bio: null,
  };

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Profile</h1>
          <p className='text-sm text-muted-foreground'>Manage your personal information and AI context.</p>
        </div>
      </div>
      <ProfileForm profile={data} />
    </div>
  );
};

export default ProfilePage;
