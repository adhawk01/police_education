export interface SearchAreaOption {
  id: number;
  name: string;
}

export interface SearchCityOption {
  id: number;
  name: string;
  area_id: number | null;
}

export interface SearchOption {
  value: string | number;
  label: string;
  id?: number | null;
}

export interface SearchCategoryOption {
  id: number;
  name: string;
  color: string | null;
  parent_id: number | null;
  priority: number | null;
}

export interface SearchFiltersResponse {
  areas: SearchAreaOption[];
  cities: SearchCityOption[];
  statuses: SearchOption[];
  activity_types: SearchOption[];
  categories: SearchCategoryOption[];
  age_groups: SearchOption[];
  audience_types: SearchOption[];
  days_of_week: SearchOption[];
  time_of_day: SearchOption[];
}

export interface SearchRequest {
  q: string | null;
  area_id: number | null;
  region: string | number | null;
  city: number | string | null;
  age_group: string | number | null;
  status: string | null;
  activity_type: string | null;
  category_ids: number[];
  audience_ids: number[];
  day_of_week: number | null;
  time_of_day: string | number | null;
  page: number;
  page_size: number;
  sort_by: string;
}

export interface SearchResultCategory {
  id: number;
  name: string;
  color_code: string | null;
}

export interface SearchResultBadge {
  id: number;
  name: string;
}

export interface SearchResultMetadata {
  area: string | null;
  city: string | null;
  age_text: string | null;
  participants_text: string | null;
  price_text: string | null;
  status_text: string | null;
  schedule_text: string | null;
}

export interface SearchResultCoordinates {
  latitude: number | string;
  longitude: number | string;
}

export interface SearchResultItem {
  id: number;
  title: string;
  short_description: string | null;
  full_description: string | null;
  primary_image_url: string | null;
  categories: SearchResultCategory[];
  badges: SearchResultBadge[];
  metadata: SearchResultMetadata;
  primary_category_color: string | null;
  marker_color: string | null;
  coordinates: SearchResultCoordinates | null;
  is_featured: number | boolean | null;
  activity_type: string | null;
  published_at: string | null;
}

export interface SearchResponse {
  total_count: number;
  page: number;
  page_size: number;
  items: SearchResultItem[];
}

export interface SearchSortOption {
  value: string;
  label: string;
}