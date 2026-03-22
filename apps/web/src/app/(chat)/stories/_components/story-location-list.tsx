import { prisma } from '@harness/database';
import { MapPin } from 'lucide-react';

type StoryLocationListProps = { storyId: string };
type StoryLocationListComponent = (props: StoryLocationListProps) => Promise<React.ReactNode>;

export const StoryLocationList: StoryLocationListComponent = async ({ storyId }) => {
  const locations = await prisma.storyLocation.findMany({
    where: { storyId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, parentId: true },
  });

  if (locations.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center'>
        <MapPin className='h-8 w-8 text-muted-foreground/50' />
        <p className='text-sm text-muted-foreground'>Locations will appear here as the story expands.</p>
      </div>
    );
  }

  // Build tree: top-level first, then children indented
  const topLevel = locations.filter((l) => !l.parentId);
  const children = locations.filter((l) => l.parentId);
  const childrenByParent = new Map<string, typeof locations>();
  for (const child of children) {
    const existing = childrenByParent.get(child.parentId!) ?? [];
    existing.push(child);
    childrenByParent.set(child.parentId!, existing);
  }

  const renderLocation = (loc: (typeof locations)[0], indent: number) => (
    <div key={loc.id} className='flex items-start gap-2 py-1' style={{ paddingLeft: indent * 20 }}>
      <MapPin className='mt-0.5 h-3 w-3 shrink-0 text-muted-foreground' />
      <div className='flex flex-col'>
        <span className='text-sm'>{loc.name}</span>
        {loc.description && <span className='text-xs text-muted-foreground'>{loc.description}</span>}
      </div>
    </div>
  );

  return (
    <div className='flex flex-col rounded-lg border px-3 py-2'>
      {topLevel.map((loc) => (
        <div key={loc.id}>
          {renderLocation(loc, 0)}
          {(childrenByParent.get(loc.id) ?? []).map((child) => renderLocation(child, 1))}
        </div>
      ))}
    </div>
  );
};
