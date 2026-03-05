# Research: youtubei.js API Surface for YouTube Music

Date: 2026-03-05

## Summary

Complete API surface documentation for `youtubei.js` (npm package), specifically the `yt.music.*` namespace. Covers initialization, search, track info, streaming data retrieval, audio format selection, and radio/up-next queue functionality.

## Prior Research

- `AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md` — library landscape overview

## Current Findings

### 1. Initialization — `Innertube.create()`

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';

// Minimal (no cache, anonymous session)
const yt = await Innertube.create();

// Recommended for production (persistent cache, faster session)
const yt = await Innertube.create({
  cache: new UniversalCache(true),      // true = persistent on disk
  generate_session_locally: true,        // faster, avoids network round-trip
  lang: 'en',                            // UI language
  location: 'US',                        // country for content region
  retrieve_player: true,                 // REQUIRED for streaming data / downloads
  enable_safety_mode: false,
  cookie: 'YOUR_COOKIE_STRING',          // for authenticated requests
  po_token: 'PROOF_OF_ORIGIN_TOKEN',    // bypass bot protection if needed
});

console.log(yt.session.logged_in); // false unless cookie provided
```

Key note: `retrieve_player: true` is required when you need streaming URLs. Without it, `streaming_data` may be unavailable.

Source: https://context7.com/luanrt/youtube.js/llms.txt

---

### 2. YouTube Music Search — `yt.music.search()`

```typescript
// Signature (from Music.ts source):
search(query: string, filters: MusicSearchFilters = {}): Promise<Search>

// Filter type values: 'song' | 'video' | 'album' | 'playlist' | 'artist'
const songs = await yt.music.search('Daft Punk', { type: 'song' });
const artists = await yt.music.search('Daft Punk', { type: 'artist' });
const albums = await yt.music.search('Discovery', { type: 'album' });
const playlists = await yt.music.search('chill mix', { type: 'playlist' });
```

The `Search` object returned has **category-specific getters** (NOT a unified `.results` array):

```typescript
// Getters on Search object:
search.songs      // MusicShelf | undefined  — song results section
search.videos     // MusicShelf | undefined  — video results section
search.albums     // MusicShelf | undefined  — album results section
search.artists    // MusicShelf | undefined  — artist results section
search.playlists  // MusicShelf | undefined  — playlist results section
search.filters    // string[]               — available filter names
search.has_continuation // boolean
search.did_you_mean     // DidYouMean | undefined
search.message          // Message | undefined

// Accessing individual items from a shelf:
const shelf = search.songs;
// shelf.contents is ObservedArray<MusicResponsiveListItem>
for (const item of shelf?.contents ?? []) {
  console.log(item.id);           // video ID
  console.log(item.title);        // track title (string)
  console.log(item.artists);      // array of { name, channel_id, endpoint }
  console.log(item.album);        // { id, name, endpoint } or undefined
  console.log(item.duration);     // { text: '3:33', seconds: 213 }
  console.log(item.thumbnails);   // Thumbnail[] (from getter, calls this.thumbnail?.contents)
  console.log(item.item_type);    // 'song' | 'video' | 'album' | 'artist' | ...
}

// Pagination:
const nextPage = await search.getContinuation();
// Load more within a shelf:
const moreItems = await search.getMore(shelf);
```

Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/parser/ytmusic/Search.ts

---

### 3. MusicResponsiveListItem — Full Field Reference

Each result item in search shelf contents is a `MusicResponsiveListItem`:

```typescript
// Direct properties:
item.id           // string | undefined — the video ID
item.title        // string | undefined
item.duration     // { text: string, seconds: number } | undefined
item.album        // { id: string, name: string, endpoint: NavigationEndpoint } | undefined
item.artists      // Array<{ name: string, channel_id: string, endpoint: NavigationEndpoint }> | undefined
item.author       // { name: string, channel_id: string, endpoint: NavigationEndpoint } | undefined
item.authors      // Array<{ name, channel_id, endpoint }> | undefined  (alias for artists)
item.views        // string | undefined (e.g. "10M views")
item.year         // string | undefined
item.song_count   // string | undefined (for playlists)
item.subscribers  // string | undefined (for artists)
item.item_type    // 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'non_music_track' | ...
item.subtitle     // Text object | undefined
item.thumbnail    // MusicThumbnail | null (raw)
item.endpoint     // NavigationEndpoint | undefined
item.menu         // Menu | null
item.item_count   // string | undefined

// Getter:
item.thumbnails   // Thumbnail[] — computed as this.thumbnail?.contents ?? []
// Each Thumbnail: { url: string, width: number, height: number }
```

To extract the best thumbnail URL:
```typescript
const thumb = item.thumbnails.at(-1); // last = highest resolution
const thumbUrl = thumb?.url ?? null;
```

Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/parser/classes/MusicResponsiveListItem.ts

---

### 4. Streaming Data & Audio URLs

There are two distinct approaches:

#### Approach A — `yt.getStreamingData()` (top-level, direct URL)

```typescript
// Returns a single chosen Format object
const format = await yt.getStreamingData('dQw4w9WgXcQ', {
  type: 'audio',     // 'video' | 'audio' | 'video+audio'
  quality: 'best',   // 'best' | 'bestefficiency' | '144p' etc
  format: 'any',     // 'mp4' | 'webm' | 'any'
  client: 'YTMUSIC', // use YTMUSIC client for music content
});

console.log(format.url);                // string — direct streaming URL (deciphered)
console.log(format.mime_type);          // e.g. 'audio/webm; codecs="opus"'
console.log(format.bitrate);            // number (bits/s)
console.log(format.average_bitrate);    // number | undefined
console.log(format.audio_quality);      // e.g. 'AUDIO_QUALITY_MEDIUM'
console.log(format.audio_sample_rate);  // e.g. 48000
console.log(format.audio_channels);     // e.g. 2
console.log(format.approx_duration_ms); // number
console.log(format.has_audio);          // true
console.log(format.has_video);          // false (for audio type)
console.log(format.itag);               // number
```

#### Approach B — `yt.music.getInfo()` then access `.streaming_data`

```typescript
// Signature:
getInfo(
  target: string | MusicTwoRowItem | MusicResponsiveListItem | NavigationEndpoint,
  options?: Omit<GetVideoInfoOptions, 'client'>
): Promise<TrackInfo>

// Usage:
const info = await yt.music.getInfo('dQw4w9WgXcQ');

// TrackInfo inherits from MediaInfo which has:
info.streaming_data              // IStreamingData | undefined
info.streaming_data?.formats     // Format[] — muxed (audio+video)
info.streaming_data?.adaptive_formats  // Format[] — separated audio and video

// Manually pick best audio-only adaptive format:
const audioFormats = info.streaming_data?.adaptive_formats.filter(
  (f) => f.has_audio && !f.has_video
) ?? [];
// Sort by bitrate descending to get best quality:
audioFormats.sort((a, b) => (b.average_bitrate ?? b.bitrate) - (a.average_bitrate ?? a.bitrate));
const bestAudio = audioFormats[0];
console.log(bestAudio?.url);

// OR use the built-in chooseFormat method:
const chosen = info.chooseFormat({ type: 'audio', quality: 'best' });
console.log(chosen.url);
```

#### Approach C — `yt.download()` for stream piping

```typescript
const stream = await yt.download('dQw4w9WgXcQ', {
  type: 'audio',
  quality: 'best',
  client: 'YTMUSIC',
});
// stream is ReadableStream<Uint8Array>
```

Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/core/mixins/MediaInfo.ts
Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/utils/FormatUtils.ts

---

### 5. Best Audio Format Selection

The `Format` class has these fields for audio selection:

```typescript
interface Format {
  itag: number;
  url?: string;                    // deciphered direct URL (undefined if not deciphered)
  signature_cipher?: string;       // raw cipher (before deciphering)
  mime_type: string;               // e.g. 'audio/webm; codecs="opus"'
  bitrate: number;
  average_bitrate?: number;
  audio_quality?: string;          // 'AUDIO_QUALITY_LOW' | 'AUDIO_QUALITY_MEDIUM' | 'AUDIO_QUALITY_HIGH'
  audio_sample_rate?: number;      // e.g. 48000
  audio_channels?: number;         // e.g. 2
  approx_duration_ms: number;
  has_audio: boolean;
  has_video: boolean;
  content_length?: number;         // bytes
  language?: string | null;
  is_original?: boolean;
  is_dubbed?: boolean;
  loudness_db?: number;
  init_range?: { start: number, end: number };
  index_range?: { start: number, end: number };
  is_type_otf: boolean;            // OTF (On The Fly) streaming
  last_modified: Date;
}
```

Recommended selection pattern for best audio:

```typescript
const audioFormats = info.streaming_data?.adaptive_formats.filter(
  (f) => f.has_audio && !f.has_video && f.url // only deciphered
) ?? [];

// Prefer opus/webm (best quality for streaming), fallback to mp4/aac
const opusFormats = audioFormats.filter((f) => f.mime_type.includes('opus'));
const candidates = opusFormats.length > 0 ? opusFormats : audioFormats;

// Sort by average_bitrate (prefer) or bitrate descending
candidates.sort(
  (a, b) => (b.average_bitrate ?? b.bitrate) - (a.average_bitrate ?? a.bitrate)
);
const best = candidates[0];
```

---

### 6. Radio / Up Next — Queue Functionality

Two entry points exist:

#### `yt.music.getUpNext()` — standalone (takes video_id string)

```typescript
// Signature:
getUpNext(video_id: string, automix = true): Promise<PlaylistPanel>

// Usage:
const queue = await yt.music.getUpNext('dQw4w9WgXcQ');
// automix=true (default) follows the automix endpoint for infinite radio-style queue
// automix=false returns a fixed playlist if the video is in one

// PlaylistPanel structure:
queue.title           // string (e.g. "Up next")
queue.playlist_id     // string | undefined
queue.contents        // ObservedArray<PlaylistPanelVideo | ...>

for (const item of queue.contents) {
  if (item.type === 'PlaylistPanelVideo') {
    item.video_id      // string — the video ID
    item.title         // Text object — call .toString() or .text for string
    item.author        // string — artist name
    item.artists       // Array<{ name, channel_id, endpoint }> | undefined
    item.album         // { id, name, year, endpoint } | undefined
    item.thumbnail     // Thumbnail[] — array of thumbnail sizes
    item.duration      // { text: string, seconds: number }
    item.selected      // boolean — currently playing?
    item.set_video_id  // string | undefined — for playlist continuations
    item.endpoint      // NavigationEndpoint
  }
}
```

#### `trackInfo.getUpNext()` — from TrackInfo object

```typescript
const info = await yt.music.getInfo('dQw4w9WgXcQ');
const queue = await info.getUpNext(/* automix = true */);
// Returns same PlaylistPanel structure as above
```

#### Continuation for infinite radio

```typescript
// Fetch next batch of radio tracks:
const continuation = await info.getUpNextContinuation(queue);
// continuation is PlaylistPanelContinuation with more contents
```

#### `yt.music.getRelated()` — related content sections

```typescript
// Signature:
getRelated(video_id: string): Promise<ObservedArray<MusicCarouselShelf | MusicDescriptionShelf>>

// Also available on TrackInfo:
const related = await info.getRelated();
// Returns carousels (similar tracks, "more by artist", etc.)
```

Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/core/clients/Music.ts
Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/parser/ytmusic/TrackInfo.ts
Source: https://raw.githubusercontent.com/LuanRT/YouTube.js/main/src/parser/classes/PlaylistPanelVideo.ts

---

### 7. Initialization Options Summary

```typescript
interface CreateOptions {
  cache?: UniversalCache | null;          // UniversalCache(false) = in-memory, (true) = persistent
  generate_session_locally?: boolean;     // true = faster, skips network round-trip
  lang?: string;                          // e.g. 'en', 'fr', 'de'
  location?: string;                      // e.g. 'US', 'GB'
  retrieve_player?: boolean;              // REQUIRED = true for streaming URLs
  enable_safety_mode?: boolean;           // content filtering
  cookie?: string;                        // YouTube cookie for auth
  po_token?: string;                      // Proof of Origin token (anti-bot)
}
```

---

## Complete Working Example

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';

// Initialize
const yt = await Innertube.create({
  cache: new UniversalCache(false),
  generate_session_locally: true,
  retrieve_player: true,
  lang: 'en',
  location: 'US',
});

// --- Search ---
const results = await yt.music.search('Daft Punk Around the World', { type: 'song' });
const songs = results.songs?.contents ?? [];

for (const song of songs) {
  console.log({
    id: song.id,
    title: song.title,
    artist: song.artists?.[0]?.name,
    album: song.album?.name,
    duration: song.duration?.seconds,
    thumbnail: song.thumbnails.at(-1)?.url,
    itemType: song.item_type,  // 'song'
  });
}

// --- Get streaming URL ---
const firstSong = songs[0];
if (!firstSong?.id) throw new Error('No result');

// Option 1: Direct URL lookup (simplest)
const format = await yt.getStreamingData(firstSong.id, {
  type: 'audio',
  quality: 'best',
  client: 'YTMUSIC',
});
console.log('Stream URL:', format.url);
console.log('Mime:', format.mime_type);
console.log('Bitrate:', format.average_bitrate ?? format.bitrate);

// Option 2: Full info + manual format selection
const info = await yt.music.getInfo(firstSong.id);
const audioFormats = (info.streaming_data?.adaptive_formats ?? [])
  .filter((f) => f.has_audio && !f.has_video && f.url);
audioFormats.sort((a, b) => (b.average_bitrate ?? b.bitrate) - (a.average_bitrate ?? a.bitrate));
const bestAudio = audioFormats[0];
console.log('Best audio URL:', bestAudio?.url);
console.log('Audio quality:', bestAudio?.audio_quality);

// --- Radio / Up Next ---
const queue = await yt.music.getUpNext(firstSong.id);
// or: const queue = await info.getUpNext();

for (const item of queue.contents) {
  if (item.is(/* PlaylistPanelVideo */)) {
    console.log({
      videoId: item.video_id,
      title: item.title?.toString(),
      artist: item.author,
      duration: item.duration?.seconds,
    });
  }
}

// Fetch next page of radio queue:
const moreTracks = await info.getUpNextContinuation(queue);
```

---

## Key Takeaways

1. **`yt.music` is the correct namespace** — not `yt.search()`. The top-level search is for regular YouTube; `yt.music.search()` hits the YTMusic endpoint.

2. **Search results are NOT in `.results`** — they're in category getters: `.songs`, `.videos`, `.albums`, `.artists`, `.playlists`. Each is a `MusicShelf` with a `.contents` array of `MusicResponsiveListItem`.

3. **`item.id` is the video ID** on `MusicResponsiveListItem` (NOT `item.videoId` — it's `item.id`).

4. **`item.artists` is an array** (multiple artists). Access with `item.artists?.[0]?.name`.

5. **`retrieve_player: true` is mandatory** in `Innertube.create()` for streaming URLs to be present.

6. **`client: 'YTMUSIC'`** should be passed to `getStreamingData()` and `download()` for music content — it uses the correct YTMusic client context.

7. **`getUpNext(videoId, automix=true)`** is on BOTH `yt.music` directly AND on `TrackInfo`. The `automix=true` default triggers the infinite radio behavior.

8. **`PlaylistPanelVideo.title` is a `Text` object** — call `.toString()` or access `.text` to get a string.

9. **Format URL may be undefined** if `retrieve_player` is false or the format hasn't been deciphered. Always check `f.url` before using.

10. **`audio_quality` values**: `'AUDIO_QUALITY_LOW'`, `'AUDIO_QUALITY_MEDIUM'`, `'AUDIO_QUALITY_HIGH'`. Prefer selecting by `average_bitrate` for accuracy.

## Sources

- [Context7 — youtubei.js docs](https://context7.com/luanrt/youtube.js/llms.txt) (HIGH confidence — official lib docs)
- [GitHub — LuanRT/YouTube.js](https://github.com/LuanRT/YouTube.js) (HIGH confidence — source code)
- [Music.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/core/clients/Music.ts)
- [TrackInfo.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/parser/ytmusic/TrackInfo.ts)
- [MusicResponsiveListItem.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/parser/classes/MusicResponsiveListItem.ts)
- [PlaylistPanelVideo.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/parser/classes/PlaylistPanelVideo.ts)
- [MediaInfo.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/core/mixins/MediaInfo.ts)
- [FormatUtils.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/utils/FormatUtils.ts)
- [Search.ts source](https://github.com/LuanRT/YouTube.js/blob/main/src/parser/ytmusic/Search.ts)
- [youtubei.js npm page](https://www.npmjs.com/package/youtubei.js)
