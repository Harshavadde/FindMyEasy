export type FoodPreference = "veg" | "non_veg";

export type MemberStatus = "active" | "left";

export type HostelMember = {
  id: string;
  listing_id: string;
  sharing_id: string;
  sharing_type: string;

  name: string;
  phone: string;

  aadhaar_photo_available: boolean;

  room_number: string;

  amount_to_pay: number;
  amount_paid: number;
  amount_pending: number;

  food_preference: FoodPreference;

  joining_date: string;
  leaving_date: string | null;

  status: MemberStatus;
};

export type MemberStats = {
  total_members: number;

  veg_members: number;
  non_veg_members: number;

  total_beds: number;
  occupied_beds: number;
  available_beds: number;

  total_amount: number;
  paid_amount: number;
  pending_amount: number;
};

export type ListingSharing = {
  id: string;
  sharing_type: string;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
};

export type MemberFormData = {
  name: string;
  phone: string;

  sharing_id: string;
  room_number: string;

  amount_to_pay: string;
  amount_paid: string;

  food_preference: FoodPreference;

  joining_date: string;
  leaving_date: string;

  aadhaar_photo_uri?: string;
};