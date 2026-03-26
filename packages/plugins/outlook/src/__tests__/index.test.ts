import { describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/search-emails', () => ({
  searchEmails: vi.fn().mockResolvedValue('search result'),
}));
vi.mock('../_helpers/read-email', () => ({
  readEmail: vi.fn().mockResolvedValue('read result'),
}));
vi.mock('../_helpers/list-recent', () => ({
  listRecent: vi.fn().mockResolvedValue('list result'),
}));
vi.mock('../_helpers/send-email', () => ({
  sendEmail: vi.fn().mockResolvedValue('send result'),
}));
vi.mock('../_helpers/reply-email', () => ({
  replyEmail: vi.fn().mockResolvedValue('reply result'),
}));
vi.mock('../_helpers/move-email', () => ({
  moveEmail: vi.fn().mockResolvedValue('move result'),
}));
vi.mock('../_helpers/list-folders', () => ({
  listFolders: vi.fn().mockResolvedValue('folders result'),
}));
vi.mock('../_helpers/find-unsubscribe-links', () => ({
  findUnsubscribeLinks: vi.fn().mockResolvedValue('unsub result'),
}));

import { findUnsubscribeLinks } from '../_helpers/find-unsubscribe-links';
import { listFolders } from '../_helpers/list-folders';
import { listRecent } from '../_helpers/list-recent';
import { moveEmail } from '../_helpers/move-email';
import { readEmail } from '../_helpers/read-email';
import { replyEmail } from '../_helpers/reply-email';
import { searchEmails } from '../_helpers/search-emails';
import { sendEmail } from '../_helpers/send-email';
import { plugin } from '../index';

const mockCtx = {} as never;
const mockMeta = { threadId: 't1' } as never;

const findTool = (name: string) => plugin.tools!.find((t) => t.name === name)!;

describe('outlook plugin', () => {
  it('register returns empty hooks', async () => {
    const hooks = await plugin.register({} as never);
    expect(hooks).toEqual({});
  });

  describe('search_emails', () => {
    it('defaults top to 20', async () => {
      await findTool('search_emails').handler(mockCtx, { query: 'test' }, mockMeta);
      expect(searchEmails).toHaveBeenCalledWith(mockCtx, 'test', 20);
    });

    it('clamps top to 50', async () => {
      await findTool('search_emails').handler(mockCtx, { query: 'test', top: 100 }, mockMeta);
      expect(searchEmails).toHaveBeenCalledWith(mockCtx, 'test', 50);
    });
  });

  describe('read_email', () => {
    it('forwards messageId', async () => {
      await findTool('read_email').handler(mockCtx, { messageId: 'msg-1' }, mockMeta);
      expect(readEmail).toHaveBeenCalledWith(mockCtx, 'msg-1');
    });
  });

  describe('list_recent', () => {
    it('defaults folder to undefined and top to 20', async () => {
      await findTool('list_recent').handler(mockCtx, {}, mockMeta);
      expect(listRecent).toHaveBeenCalledWith(mockCtx, undefined, 20);
    });

    it('clamps top to 50', async () => {
      await findTool('list_recent').handler(mockCtx, { folder: 'sent', top: 999 }, mockMeta);
      expect(listRecent).toHaveBeenCalledWith(mockCtx, 'sent', 50);
    });
  });

  describe('send_email', () => {
    it('forwards all fields', async () => {
      const input = {
        to: ['a@b.com'],
        cc: ['c@d.com'],
        bcc: ['e@f.com'],
        subject: 's',
        body: 'b',
        isHtml: true,
      };
      await findTool('send_email').handler(mockCtx, input, mockMeta);
      expect(sendEmail).toHaveBeenCalledWith(mockCtx, {
        to: ['a@b.com'],
        cc: ['c@d.com'],
        bcc: ['e@f.com'],
        subject: 's',
        body: 'b',
        isHtml: true,
      });
    });
  });

  describe('reply_email', () => {
    it('forwards messageId and comment', async () => {
      await findTool('reply_email').handler(mockCtx, { messageId: 'msg-1', comment: 'thanks' }, mockMeta);
      expect(replyEmail).toHaveBeenCalledWith(mockCtx, 'msg-1', 'thanks');
    });
  });

  describe('move_email', () => {
    it('forwards messageId and folder', async () => {
      await findTool('move_email').handler(mockCtx, { messageId: 'msg-1', folder: 'trash' }, mockMeta);
      expect(moveEmail).toHaveBeenCalledWith(mockCtx, 'msg-1', 'trash');
    });
  });

  describe('list_folders', () => {
    it('calls listFolders with context', async () => {
      await findTool('list_folders').handler(mockCtx, {}, mockMeta);
      expect(listFolders).toHaveBeenCalledWith(mockCtx);
    });
  });

  describe('find_unsubscribe_links', () => {
    it('defaults top to undefined', async () => {
      await findTool('find_unsubscribe_links').handler(mockCtx, {}, mockMeta);
      expect(findUnsubscribeLinks).toHaveBeenCalledWith(mockCtx, { top: undefined, reportProgress: undefined });
    });
  });
});
