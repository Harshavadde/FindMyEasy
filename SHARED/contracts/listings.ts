export type ListingImageContract = {
  id: string;
  image_type: string;
  url: string | null;
  image_url?: string | null;
  original_filename?: string | null;
};

export type AdminListingContract = {
  id: string;
  name: string;
  property_type: string;
  gender: string;
  description: string | null;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  owner_phone: string | null;
  status: string;
  facilities: string[];
  images: ListingImageContract[];
};
