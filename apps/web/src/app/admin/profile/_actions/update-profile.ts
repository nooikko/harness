'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateProfile = (formData: FormData) => Promise<void>;

export const updateProfile: UpdateProfile = async (formData) => {
  const name = formData.get('name') as string;
  const pronouns = (formData.get('pronouns') as string) || null;
  const ageRaw = formData.get('age') as string;
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : null;
  const gender = (formData.get('gender') as string) || null;
  const location = (formData.get('location') as string) || null;
  const interests = (formData.get('interests') as string) || null;
  const bio = (formData.get('bio') as string) || null;

  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    create: { name, pronouns, age, gender, location, interests, bio },
    update: { name, pronouns, age, gender, location, interests, bio },
  });

  revalidatePath('/admin/profile');
  revalidatePath('/');
};
