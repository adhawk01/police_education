export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface FeaturedItem {
  id: number;
  title: string;
  description: string;
  category: string;
  region: string;
  contentType: string;
  tags: string[];
  isFeatured: boolean;
}

export interface MapColorLegendItem {
  id: number;
  label: string;
  color: string;
  count: number;
}