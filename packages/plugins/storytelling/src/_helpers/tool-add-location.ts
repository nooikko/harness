import type { PrismaClient } from '@harness/database';

type AddLocationInput = {
  name: string;
  description?: string;
  parentName?: string;
  distance?: string;
  direction?: string;
};

type HandleAddLocation = (db: PrismaClient, storyId: string, input: AddLocationInput) => Promise<string>;

export const handleAddLocation: HandleAddLocation = async (db, storyId, input) => {
  let parentId: string | undefined;

  if (input.parentName) {
    const parent = await db.storyLocation.findUnique({
      where: {
        storyId_name: { storyId, name: input.parentName },
      },
    });

    if (!parent) {
      return `Error: parent location "${input.parentName}" not found in this story.`;
    }

    parentId = parent.id;
  }

  const location = await db.storyLocation.create({
    data: {
      storyId,
      name: input.name,
      description: input.description,
      parentId,
    },
  });

  if (parentId && (input.distance || input.direction)) {
    await db.locationRelationship.create({
      data: {
        fromId: parentId,
        toId: location.id,
        distance: input.distance,
        direction: input.direction,
      },
    });
  }

  const parts = [`Added location "${input.name}".`];
  if (parentId) {
    parts.push(`Parent: "${input.parentName}".`);
  }
  if (input.distance || input.direction) {
    const rel = [input.distance, input.direction].filter(Boolean).join(', ');
    parts.push(`Relationship: ${rel}.`);
  }

  return parts.join(' ');
};
