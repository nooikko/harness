// Send proactive DM — opens a DM channel with a Discord user and sends a message

import type { Client, User } from 'discord.js';

type SendProactiveDm = (params: { client: Client; userId: string; content: string; splitMessage: (content: string) => string[] }) => Promise<void>;

export const sendProactiveDm: SendProactiveDm = async ({ client, userId, content, splitMessage }) => {
  const user: User = await client.users.fetch(userId);
  const dmChannel = await user.createDM();

  const chunks = splitMessage(content);
  for (const chunk of chunks) {
    await dmChannel.send(chunk);
  }
};
