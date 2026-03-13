import { describe, expect, it } from 'vitest';
import { formatUserProfileSection } from '../format-user-profile-section';

describe('formatUserProfileSection', () => {
  it('returns empty string for null profile', () => {
    expect(formatUserProfileSection(null)).toBe('');
  });

  it('returns empty string for default profile (name User, everything else null)', () => {
    const profile = {
      id: 'singleton',
      name: 'User',
      pronouns: null,
      age: null,
      gender: null,
      location: null,
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(formatUserProfileSection(profile)).toBe('');
  });

  it('formats full profile with all fields', () => {
    const profile = {
      id: 'singleton',
      name: 'Quinn',
      pronouns: 'they/them',
      age: 28,
      gender: 'Non-binary',
      location: 'Phoenix, AZ',
      interests: 'homelab, TypeScript, AI',
      bio: 'I build things.',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('<user_profile>');
    expect(result).toContain('</user_profile>');
    expect(result).toContain('Name: Quinn');
    expect(result).toContain('Pronouns: they/them');
    expect(result).toContain('Age: 28');
    expect(result).toContain('Gender: Non-binary');
    expect(result).toContain('Location: Phoenix, AZ');
    expect(result).toContain('Interests: homelab, TypeScript, AI');
    expect(result).toContain('Bio: I build things.');
  });

  it('omits null fields from output', () => {
    const profile = {
      id: 'singleton',
      name: 'Quinn',
      pronouns: null,
      age: null,
      gender: null,
      location: 'Phoenix, AZ',
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('Name: Quinn');
    expect(result).toContain('Location: Phoenix, AZ');
    expect(result).not.toContain('Pronouns');
    expect(result).not.toContain('Age');
    expect(result).not.toContain('Gender');
    expect(result).not.toContain('Interests');
    expect(result).not.toContain('Bio');
  });

  it('includes name even when it is User if other fields are present', () => {
    const profile = {
      id: 'singleton',
      name: 'User',
      pronouns: null,
      age: null,
      gender: null,
      location: 'Phoenix, AZ',
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('Name: User');
    expect(result).toContain('Location: Phoenix, AZ');
  });
});
