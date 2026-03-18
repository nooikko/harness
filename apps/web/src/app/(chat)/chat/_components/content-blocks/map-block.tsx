'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type MapBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const ALLOWED_EMBED_HOSTS = new Set(['www.google.com', 'maps.google.com', 'www.openstreetmap.org']);

type IsAllowedEmbedUrl = (url: string) => boolean;

const isAllowedEmbedUrl: IsAllowedEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ALLOWED_EMBED_HOSTS.has(parsed.hostname) && parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

type BuildGoogleMapsUrl = (query: string) => string;

const buildGoogleMapsUrl: BuildGoogleMapsUrl = (query) => `https://www.google.com/maps?q=${encodeURIComponent(query)}`;

const MapBlock: MapBlockComponent = ({ data }) => {
  const address = (data.address ?? data.query ?? '') as string;
  const label = (data.label ?? address) as string;
  const embedUrl = (data.embedUrl ?? '') as string;
  const lat = data.lat as number | undefined;
  const lng = data.lng as number | undefined;

  const mapsLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : buildGoogleMapsUrl(address);

  const hasEmbed = embedUrl && isAllowedEmbedUrl(embedUrl);

  return (
    <div className='rounded-md border border-border/40 overflow-hidden'>
      {hasEmbed ? (
        <iframe
          src={embedUrl}
          title={`Map: ${label}`}
          className='h-48 w-full border-0'
          loading='lazy'
          referrerPolicy='no-referrer'
          sandbox='allow-scripts allow-same-origin'
        />
      ) : (
        <div className='flex h-32 items-center justify-center bg-muted/30'>
          <div className='text-center'>
            <MapPin className='mx-auto h-8 w-8 text-muted-foreground/40' />
            <p className='mt-1 text-sm text-muted-foreground/60'>{label}</p>
          </div>
        </div>
      )}
      <div className='flex items-center justify-between border-t border-border/30 px-3 py-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <MapPin className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
          <span className='truncate text-sm text-foreground/80'>{label}</span>
        </div>
        <a
          href={mapsLink}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline'
        >
          Open in Maps <ExternalLink className='h-3 w-3' />
        </a>
      </div>
    </div>
  );
};

export default MapBlock;
