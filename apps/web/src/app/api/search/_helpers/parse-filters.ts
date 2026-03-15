import type { ParsedSearchQuery } from '@/app/_helpers/parse-search-filters';
import { parseSearchFilters } from '@/app/_helpers/parse-search-filters';

// Re-export from shared module — single source of truth for filter parsing
export const parseFilters = parseSearchFilters;
export type ParsedQuery = ParsedSearchQuery;
