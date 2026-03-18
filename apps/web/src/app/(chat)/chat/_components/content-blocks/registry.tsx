'use client';

import { lazy } from 'react';

type ContentBlockProps = {
  data: Record<string, unknown>;
};

type ContentBlockComponent = React.ComponentType<ContentBlockProps>;

export type { ContentBlockProps };

const CalendarDaySummaryBlock = lazy(() => import('./calendar-day-summary-block'));
const CalendarWeekOverviewBlock = lazy(() => import('./calendar-week-overview-block'));
const EmailListBlock = lazy(() => import('./email-list-block'));
const MapBlock = lazy(() => import('./map-block'));
const TimerBlock = lazy(() => import('./timer-block'));
const RecipeBlock = lazy(() => import('./recipe-block'));
const CalendarEventsBlock = lazy(() => import('./calendar-events-block'));
const NowPlayingBlock = lazy(() => import('./now-playing-block'));
const TaskListBlock = lazy(() => import('./task-list-block'));
const MusicSearchBlock = lazy(() => import('./music-search-block'));
const CronJobsBlock = lazy(() => import('./cron-jobs-block'));
const EmailFoldersBlock = lazy(() => import('./email-folders-block'));

const BLOCK_REGISTRY: Record<string, ContentBlockComponent> = {
  'email-list': EmailListBlock,
  'email-folders': EmailFoldersBlock,
  map: MapBlock,
  timer: TimerBlock,
  recipe: RecipeBlock,
  'calendar-events': CalendarEventsBlock,
  'calendar-day-summary': CalendarDaySummaryBlock,
  'calendar-week-overview': CalendarWeekOverviewBlock,
  'now-playing': NowPlayingBlock,
  'task-list': TaskListBlock,
  'music-search': MusicSearchBlock,
  'cron-jobs': CronJobsBlock,
};

type GetBlockRenderer = (type: string) => ContentBlockComponent | undefined;

export const getBlockRenderer: GetBlockRenderer = (type) => BLOCK_REGISTRY[type];
