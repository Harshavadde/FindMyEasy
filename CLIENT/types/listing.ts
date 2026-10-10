
export type ListingImage = {
  id: string;
  image_type: string;
  url: string | null;
};

export type ListingSharing = {
  id: string;
  sharing_type: string;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
};

export type Listing = {
  id: string;
  owner_phone?: string | null;

  name: string;
  property_type: "PG" | "Hostel" | string;
  gender: "Boy's" | "Girl's" | "Co-living" | string;
  description?: string | null;

  monthly_price: number;
  security_deposit?: number | null;

  total_beds: number;
  available_beds: number;
  filled_beds: number;

  sharing: ListingSharing[] | null;
  ac_type: "AC" | "Non-AC" | string;
  facilities: string[] | null;

  food_available: "Yes" | "No" | string;
  food_type?: string | null;

  breakfast_start_time?: string | null;
  breakfast_end_time?: string | null;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  dinner_start_time?: string | null;
  dinner_end_time?: string | null;

  city: string;
  area: string;
  address: string;
  latitude?: string | null;
  longitude?: string | null;

  restrictions?: string | null;
  status: string;
  images: ListingImage[];
};
