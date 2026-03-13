'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Separator, Textarea } from '@harness/ui';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { updateProfile } from '../_actions/update-profile';

type ProfileFormProps = {
  profile: {
    name: string;
    pronouns: string | null;
    age: number | null;
    gender: string | null;
    location: string | null;
    interests: string | null;
    bio: string | null;
  };
};

type ProfileFormComponent = (props: ProfileFormProps) => React.ReactNode;

export const ProfileForm: ProfileFormComponent = ({ profile }) => {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await updateProfile(formData);
      setSaved(true);
    });
  };

  const isDefault = profile.name === 'User' && !profile.pronouns && !profile.location;

  const subtitleParts: string[] = [];
  if (profile.pronouns) {
    subtitleParts.push(profile.pronouns);
  }
  if (profile.location) {
    subtitleParts.push(profile.location);
  }

  return (
    <div className='flex flex-col gap-8'>
      {/* Profile Header Card */}
      <Card>
        <CardContent className='flex items-center gap-5 p-6'>
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary'>
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className='flex flex-col gap-0.5'>
            {isDefault ? (
              <>
                <p className='text-lg font-semibold text-foreground'>Set up your profile</p>
                <p className='text-sm text-muted-foreground'>Tell your AI assistant about yourself to personalize your experience.</p>
              </>
            ) : (
              <>
                <p className='text-lg font-semibold text-foreground'>{profile.name}</p>
                {subtitleParts.length > 0 && <p className='text-sm text-muted-foreground'>{subtitleParts.join(' · ')}</p>}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <form ref={formRef} action={handleSubmit} className='flex flex-col gap-8'>
        {/* Identity Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>Identity</CardTitle>
            <CardDescription>How you&apos;d like to be addressed.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-5'>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='name'>Name</Label>
                <Input id='name' name='name' defaultValue={profile.name} required />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='pronouns'>Pronouns</Label>
                <Input id='pronouns' name='pronouns' defaultValue={profile.pronouns ?? ''} placeholder='e.g. they/them' />
              </div>
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='age'>Age</Label>
                <Input id='age' name='age' type='number' min={0} max={150} defaultValue={profile.age ?? ''} />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='gender'>Gender</Label>
                <Input id='gender' name='gender' defaultValue={profile.gender ?? ''} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Interests Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>Location & Interests</CardTitle>
            <CardDescription>Context that helps your AI understand you better.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-5'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='location'>Location</Label>
              <Input id='location' name='location' defaultValue={profile.location ?? ''} placeholder='e.g. Phoenix, AZ' />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='interests'>Interests</Label>
              <Input id='interests' name='interests' defaultValue={profile.interests ?? ''} placeholder='e.g. homelab, TypeScript, AI agents' />
              <p className='text-xs text-muted-foreground'>Separate interests with commas.</p>
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>About</CardTitle>
            <CardDescription>Anything else you&apos;d like your AI to know about you.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='bio'>Bio</Label>
              <Textarea
                id='bio'
                name='bio'
                defaultValue={profile.bio ?? ''}
                className='min-h-[120px] resize-y'
                placeholder='Tell your assistant about yourself...'
              />
            </div>
            <Separator />
            <p className='text-xs text-muted-foreground'>This information is shared with your AI assistant to personalize responses.</p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className='flex justify-end'>
          <Button type='submit' disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Saving…
              </>
            ) : saved ? (
              <>
                <Check className='h-4 w-4' />
                Saved
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
