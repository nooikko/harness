'use server';

import { prisma } from '@harness/database';

type SshHostRow = {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: string;
  fingerprint: string | null;
  tags: string[];
  enabled: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListSshHosts = () => Promise<SshHostRow[]>;

export const listSshHosts: ListSshHosts = async () => {
  const hosts = await prisma.sshHost.findMany({
    select: {
      id: true,
      name: true,
      hostname: true,
      port: true,
      username: true,
      authMethod: true,
      fingerprint: true,
      tags: true,
      enabled: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
      // privateKey intentionally excluded for security
    },
    orderBy: { name: 'asc' },
  });

  return hosts;
};
