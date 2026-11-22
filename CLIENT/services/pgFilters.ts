import type { Listing } from "../types/listing";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function matchesPGType(
  listingGender: string,
  selectedTypes: string[]
): boolean {
  if (selectedTypes.length === 0) return true;

  const gender = normalizeText(listingGender);

  return selectedTypes.some((type) => {
    const selectedType = normalizeText(type);

    if (selectedType === "boy's") {
      return gender === "boy's" || gender === "men" || gender === "boys";
    }

    if (selectedType === "girl's") {
      return gender === "girl's" || gender === "women" || gender === "girls";
    }

    if (selectedType === "co-living") {
      return gender === "co-living";
    }

    return gender === selectedType;
  });
}

function normalizeSharing(value: string): string {
  return normalizeText(value)
    .replace("single sharing", "1 sharing")
    .replace("single", "1")
    .replace("sharing", "")
    .replace(/\s+/g, "")
    .trim();
}

export function matchesRoomSharing(
  listingSharing: Listing["sharing"],
  selectedSharing: string[]
): boolean {
  if (selectedSharing.length === 0) return true;
  if (!Array.isArray(listingSharing)) return false;

  const listingValues = listingSharing.map((item) =>
    normalizeSharing(String(item.sharing_type ?? ""))
  );

  return selectedSharing.some((selected) =>
    listingValues.includes(normalizeSharing(selected))
  );
}

export function matchesAcType(
  listingAcType: string,
  selectedAcTypes: string[]
): boolean {
  if (selectedAcTypes.length === 0) return true;

  return selectedAcTypes.some(
    (selectedType) =>
      normalizeText(listingAcType) === normalizeText(selectedType)
  );
}

export function matchesCity(
  listingCity: string,
  selectedCity: string
): boolean {
  return normalizeText(listingCity) === normalizeText(selectedCity);
}

export function matchesArea(
  listingArea: string,
  selectedAreas: string[]
): boolean {
  if (selectedAreas.length === 0) return true;

  return selectedAreas.some(
    (area) => normalizeText(listingArea) === normalizeText(area)
  );
}
