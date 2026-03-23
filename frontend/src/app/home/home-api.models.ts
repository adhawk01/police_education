export interface HomeApiCategoryItem {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  icon_name: string | null;
  color_code: string | null;
}

export interface HomeApiFeaturedItem {
  id: number;
  title: string;
  short_description: string | null;
  full_description: string | null;
  is_featured: number | boolean;
  content_type: string;
  published_at: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  primary_image_url: string | null;
  location_name: string | null;
  address: string | null;
  region_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
}

export interface HomeApiRegion {
  id: number;
  name: string;
}

export interface HomeApiContentType {
  code: string;
  name: string;
}

export interface HomeApiResponse {
  categories: HomeApiCategoryItem[];
  featured_items: HomeApiFeaturedItem[];
  regions: HomeApiRegion[];
  content_types: HomeApiContentType[];
}