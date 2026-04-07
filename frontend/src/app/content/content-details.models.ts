export interface ContentDetailsGalleryImage {
  id: number;
  url: string;
  alt: string | null;
}

export interface ContentDetailsCategory {
  id: number;
  name: string;
  color: string | null;
  priority: number | null;
}

export interface ContentDetailsLocation {
  area: string | null;
  city: string | null;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
}

export interface ContentDetailsInfo {
  price_text: string | null;
  age_text: string | null;
  participants_text: string | null;
  schedule_text: string | null;
  activity_type: string | null;
  status_text: string | null;
}

export interface ContentDetailsAccessibility {
  has_accessibility_info: boolean;
  text: string | null;
  features: string[];
}

export interface ContentDetailsContact {
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
}

export interface ContentDetailsRecommendedItem {
  id: number;
  title: string;
  image_url: string | null;
  short_description: string | null;
}

export interface ContentDetailsResponse {
  id: number;
  title: string;
  short_description: string | null;
  full_description: string | null;
  primary_image_url: string | null;
  gallery_images: ContentDetailsGalleryImage[];
  categories: ContentDetailsCategory[];
  badges: string[];
  location: ContentDetailsLocation;
  details: ContentDetailsInfo;
  accessibility: ContentDetailsAccessibility;
  contact: ContentDetailsContact;
  recommended_items: ContentDetailsRecommendedItem[];
}