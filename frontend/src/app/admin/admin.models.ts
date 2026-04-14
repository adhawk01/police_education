export interface AdminLookupItem {
  id: number;
  name: string;
}

export interface AdminCategory extends AdminLookupItem {
  color_code?: string | null;
}

export interface AdminStatus extends AdminLookupItem {
  code?: string;
}

export interface AdminArea extends AdminLookupItem {}

export interface AdminCity extends AdminLookupItem {
  area_id: number;
}

export interface AdminLocation {
  id: number;
  area_id: number;
  city_id?: number | null;
  place_name: string;
  address_line?: string | null;
}

export interface AdminContentType extends AdminLookupItem {
  code?: string;
}

export interface AdminAudienceType extends AdminLookupItem {}

export interface AdminMetadataResponse {
  categories: AdminCategory[];
  statuses: AdminStatus[];
  areas: AdminArea[];
  cities: AdminCity[];
  locations: AdminLocation[];
  content_types: AdminContentType[];
  audiences: AdminAudienceType[];
}

export interface AdminListItemStatus {
  id: number;
  code?: string;
  name?: string;
}

export interface AdminListItemCategory {
  id: number;
  name: string;
  color?: string | null;
}

export interface AdminListItem {
  id: number;
  title: string;
  short_description?: string | null;
  status: AdminListItemStatus;
  is_active: boolean;
  is_featured: boolean;
  categories: AdminListItemCategory[];
  location?: {
    area?: string | null;
    city?: string | null;
  };
  primary_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminListResponse {
  total_count: number;
  page: number;
  page_size: number;
  items: AdminListItem[];
}

export interface AdminListQuery {
  q?: string;
  status_id?: number | null;
  status_ids?: number[] | null;
  category_id?: number | null;
  category_ids?: number[] | null;
  city_id?: number | null;
  city_ids?: number[] | null;
  area_id?: number | null;
  area_ids?: number[] | null;
  is_active?: boolean | null;
  is_active_values?: boolean[] | null;
  page?: number;
  page_size?: number;
  sort_by?: string;
}

export interface AdminItemDetails {
  id: number;
  content_type_id: number;
  title: string;
  short_description?: string | null;
  full_description?: string | null;
  audience_notes?: string | null;
  status: {
    id: number;
    code?: string;
    name?: string;
  };
  is_active: boolean;
  is_featured: boolean;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  categories: Array<{
    category_id: number;
    category_name?: string;
    color_code?: string | null;
    priority?: number;
  }>;
  location?: {
    location_id?: number | null;
    area_id?: number | null;
    area_name?: string | null;
    city_id?: number | null;
    city_name?: string | null;
    place_name?: string | null;
    address_line?: string | null;
    accessibility_notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    is_primary?: number | boolean;
  } | null;
  operational_details?: {
    duration_minutes?: number | null;
    min_participants?: number | null;
    max_participants?: number | null;
    price_type?: string | null;
    price_min?: number | null;
    price_max?: number | null;
    currency?: string | null;
    booking_required?: number | boolean;
    security_benefit_available?: number | boolean;
    security_benefit_notes?: string | null;
    website_url?: string | null;
    booking_url?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  media?: Array<{
    media_file_id: number;
    file_url?: string | null;
    alt_text?: string | null;
    media_type?: string | null;
    is_primary?: number | boolean;
    sort_order?: number;
  }>;
}

export interface AdminWritePayload {
  content_type_id: number;
  title: string;
  short_description?: string | null;
  full_description?: string | null;
  status_id: number;
  audience_notes?: string | null;
  is_featured?: boolean;
  is_active?: boolean;
  approved_by_user_id?: number | null;
  published_at?: string | null;
  category_ids?: number[];
  location_id?: number | null;
  location_data?: {
    area_id?: number | null;
    city_id?: number | null;
    place_name?: string | null;
    address_line?: string | null;
    accessibility_notes?: string | null;
  };
  primary_media_file_id?: number | null;
  media_to_add?: Array<{ file_url: string; is_primary: boolean; alt_text?: string }>;
  media_to_remove?: number[];
  operational_details?: {
    duration_minutes?: number | null;
    min_participants?: number | null;
    max_participants?: number | null;
    price_type?: string | null;
    price_min?: number | null;
    price_max?: number | null;
    currency?: string | null;
    booking_required?: boolean;
    security_benefit_available?: boolean;
    security_benefit_notes?: string | null;
    website_url?: string | null;
    booking_url?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export interface AdminStatusPatchPayload {
  status_id: number;
  is_active?: boolean;
}
