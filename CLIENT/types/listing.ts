export type ListingImage = {
  id: string;
  image_type: string;
  url: string | null;
};

export type Listing = {
  id: string;

  owner_phone?: string | null;

  name: string;
  property_type: "PG" | "Hostel" | string;
  gender: "Men's" | "Women's" | "Co-living" | string;

  description?: string | null;

  monthly_price: number;
  security_deposit?: number | null;

  total_beds: number;
  available_beds: number;
  filled_beds: number;

  sharing: string[];

  ac_type: "AC" | "Non-AC" | string;

  facilities: string[];

  food_available: "Yes" | "No" | string;

  breakfast_time?: string | null;
  lunch_time?: string | null;
  dinner_time?: string | null;

  city: string;
  area: string;
  address: string;

  latitude?: string | null;
  longitude?: string | null;

  restrictions?: string | null;

  status: string;

  images: ListingImage[];
};