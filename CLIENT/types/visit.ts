export type NewScheduledVisit = {
  listingId: string;
  listingName: string;
  area: string;
  city: string;
  phoneNumber: string;
  preferredDate: string;
  preferredTime: string;
  showSimilarProperties: boolean;
};

export type ScheduledVisit = NewScheduledVisit & {
  id: string;
  status: "Saved this session";
  createdAt: string;
};
