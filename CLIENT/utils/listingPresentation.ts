export type ListingBadgeColors = {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

export function getListingAudienceBadge(gender: string): ListingBadgeColors {
  const normalized = gender.trim().toLowerCase();

  if (normalized.includes("girl") || normalized.includes("women")) {
    return {
      label: "Women's PG",
      backgroundColor: "#FFF1F2",
      textColor: "#BE123C",
      borderColor: "#FECDD3",
    };
  }

  if (normalized.includes("boy") || normalized.includes("men")) {
    return {
      label: "Men's PG",
      backgroundColor: "#EFF6FF",
      textColor: "#1D4ED8",
      borderColor: "#BFDBFE",
    };
  }

  if (normalized.includes("coliv")) {
    return {
      label: "Coliving",
      backgroundColor: "#F5F3FF",
      textColor: "#6D28D9",
      borderColor: "#DDD6FE",
    };
  }

  return {
    label: gender.trim() || "PG",
    backgroundColor: "#F1F5F9",
    textColor: "#475569",
    borderColor: "#E2E8F0",
  };
}

export function isVerifiedListing(status: string): boolean {
  return status.trim().toLowerCase() === "published";
}
