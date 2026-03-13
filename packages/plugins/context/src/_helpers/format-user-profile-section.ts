import type { UserProfile } from '@harness/database';

type FormatUserProfileSection = (profile: UserProfile | null) => string;

export const formatUserProfileSection: FormatUserProfileSection = (profile) => {
  if (!profile) {
    return '';
  }

  const optionalLines: string[] = [];
  if (profile.pronouns) {
    optionalLines.push(`Pronouns: ${profile.pronouns}`);
  }
  if (profile.age !== null) {
    optionalLines.push(`Age: ${profile.age}`);
  }
  if (profile.gender) {
    optionalLines.push(`Gender: ${profile.gender}`);
  }
  if (profile.location) {
    optionalLines.push(`Location: ${profile.location}`);
  }
  if (profile.interests) {
    optionalLines.push(`Interests: ${profile.interests}`);
  }
  if (profile.bio) {
    optionalLines.push(`Bio: ${profile.bio}`);
  }

  if (profile.name === 'User' && optionalLines.length === 0) {
    return '';
  }

  const lines = [`Name: ${profile.name}`, ...optionalLines];
  return `<user_profile>\n${lines.join('\n')}\n</user_profile>`;
};
