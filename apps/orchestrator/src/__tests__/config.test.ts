import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';

describe('loadConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    it('returns correct defaults when only DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      delete process.env.TZ;
      delete process.env.MAX_CONCURRENT_AGENTS;
      delete process.env.CLAUDE_MODEL_DEFAULT;
      delete process.env.CLAUDE_TIMEOUT;
      delete process.env.DISCORD_TOKEN;
      delete process.env.DISCORD_CHANNEL_ID;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.databaseUrl).toBe('postgres://localhost/test');
      expect(config.timezone).toBe('America/Phoenix');
      expect(config.maxConcurrentAgents).toBe(3);
      expect(config.claudeModel).toBe('haiku');
      expect(config.claudeTimeout).toBe(300000);
      expect(config.discordToken).toBeUndefined();
      expect(config.discordChannelId).toBeUndefined();
      expect(config.port).toBe(4001);
      expect(config.logLevel).toBe('info');
    });
  });

  describe('environment variable reading', () => {
    it('reads DATABASE_URL from environment', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@db:5432/mydb';

      const config = loadConfig();

      expect(config.databaseUrl).toBe('postgres://user:pass@db:5432/mydb');
    });

    it('reads TZ as timezone', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.TZ = 'UTC';

      const config = loadConfig();

      expect(config.timezone).toBe('UTC');
    });

    it('reads MAX_CONCURRENT_AGENTS as a number', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.MAX_CONCURRENT_AGENTS = '10';

      const config = loadConfig();

      expect(config.maxConcurrentAgents).toBe(10);
    });

    it('reads CLAUDE_MODEL_DEFAULT', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.CLAUDE_MODEL_DEFAULT = 'claude-opus-4-6';

      const config = loadConfig();

      expect(config.claudeModel).toBe('claude-opus-4-6');
    });

    it('reads CLAUDE_TIMEOUT as a number', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.CLAUDE_TIMEOUT = '60000';

      const config = loadConfig();

      expect(config.claudeTimeout).toBe(60000);
    });

    it('reads DISCORD_TOKEN', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.DISCORD_TOKEN = 'my-discord-token';

      const config = loadConfig();

      expect(config.discordToken).toBe('my-discord-token');
    });

    it('reads DISCORD_CHANNEL_ID', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.DISCORD_CHANNEL_ID = '123456789';

      const config = loadConfig();

      expect(config.discordChannelId).toBe('123456789');
    });

    it('reads PORT as a number', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.PORT = '8080';

      const config = loadConfig();

      expect(config.port).toBe(8080);
    });
  });

  describe('validation', () => {
    it('throws when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;

      expect(() => loadConfig()).toThrow('Missing required environment variable: DATABASE_URL.');
    });

    it('throws when DATABASE_URL is an empty string', () => {
      process.env.DATABASE_URL = '';

      expect(() => loadConfig()).toThrow('Missing required environment variable: DATABASE_URL.');
    });

    it('includes .env file hint in the error message', () => {
      delete process.env.DATABASE_URL;

      expect(() => loadConfig()).toThrow('.env file');
    });
  });

  describe('parseLogLevel (via loadConfig)', () => {
    it("accepts 'debug' as a valid log level", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'debug';

      const config = loadConfig();

      expect(config.logLevel).toBe('debug');
    });

    it("accepts 'info' as a valid log level", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'info';

      const config = loadConfig();

      expect(config.logLevel).toBe('info');
    });

    it("accepts 'warn' as a valid log level", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'warn';

      const config = loadConfig();

      expect(config.logLevel).toBe('warn');
    });

    it("accepts 'error' as a valid log level", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'error';

      const config = loadConfig();

      expect(config.logLevel).toBe('error');
    });

    it('normalizes uppercase log level to lowercase', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'DEBUG';

      const config = loadConfig();

      expect(config.logLevel).toBe('debug');
    });

    it('normalizes mixed-case log level to lowercase', () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'Warn';

      const config = loadConfig();

      expect(config.logLevel).toBe('warn');
    });

    it("falls back to 'info' for an unrecognized log level", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = 'verbose';

      const config = loadConfig();

      expect(config.logLevel).toBe('info');
    });

    it("falls back to 'info' when LOG_LEVEL is undefined", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.logLevel).toBe('info');
    });

    it("falls back to 'info' when LOG_LEVEL is an empty string", () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      process.env.LOG_LEVEL = '';

      const config = loadConfig();

      expect(config.logLevel).toBe('info');
    });
  });
});
