import { create } from "zustand";
import {
  addFavorite,
  getFavoriteIds,
  removeFavorite,
} from "../services/favorites";
import type { Listing } from "../types/listing";

type FavoritesState = {
  favoriteIds: Set<string>;
  favoriteListings: Listing[];
  pendingIds: Set<string>;
  hasLoaded: boolean;
  toastMessage: string | null;
  loadFavoriteIds: () => Promise<void>;
  setFavoriteIds: (ids: string[]) => void;
  setFavoriteListings: (listings: Listing[]) => void;
  toggleFavorite: (listingId: string, listing?: Listing) => Promise<void>;
  showToast: (message: string) => void;
};

let favoriteIdsRequest: Promise<void> | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function mergePendingFavoriteIds(
  ids: string[],
  favoriteIds: Set<string>,
  pendingIds: Set<string>
): Set<string> {
  const nextFavoriteIds = new Set(ids);
  pendingIds.forEach((id) => {
    if (favoriteIds.has(id)) {
      nextFavoriteIds.add(id);
    } else {
      nextFavoriteIds.delete(id);
    }
  });
  return nextFavoriteIds;
}

function mergePendingFavoriteListings(
  listings: Listing[],
  favoriteListings: Listing[],
  favoriteIds: Set<string>,
  pendingIds: Set<string>
): Listing[] {
  const nextListings = new Map(
    listings.map((listing) => [String(listing.id), listing])
  );
  const cachedListings = new Map(
    favoriteListings.map((listing) => [String(listing.id), listing])
  );

  pendingIds.forEach((id) => {
    if (favoriteIds.has(id)) {
      const listing = cachedListings.get(id);
      if (listing) nextListings.set(id, listing);
    } else {
      nextListings.delete(id);
    }
  });

  return Array.from(nextListings.values());
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: new Set(),
  favoriteListings: [],
  pendingIds: new Set(),
  hasLoaded: false,
  toastMessage: null,
  showToast: (message) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({ toastMessage: message });
    toastTimeout = setTimeout(() => {
      set({ toastMessage: null });
      toastTimeout = null;
    }, 2500);
  },
  loadFavoriteIds: () => {
    if (get().hasLoaded) return Promise.resolve();
    if (favoriteIdsRequest) return favoriteIdsRequest;

    favoriteIdsRequest = getFavoriteIds()
      .then((ids) => {
        const { favoriteIds, pendingIds } = get();
        set({
          favoriteIds: mergePendingFavoriteIds(ids, favoriteIds, pendingIds),
          hasLoaded: true,
        });
      })
      .catch((error: unknown) => {
        console.error("Unable to load favorite IDs:", error);
        throw error;
      })
      .finally(() => {
        favoriteIdsRequest = null;
      });

    return favoriteIdsRequest;
  },
  setFavoriteIds: (ids) => {
    const { favoriteIds, pendingIds } = get();
    set({
      favoriteIds: mergePendingFavoriteIds(ids, favoriteIds, pendingIds),
      hasLoaded: true,
    });
  },
  setFavoriteListings: (listings) => {
    const { favoriteIds, favoriteListings, pendingIds } = get();
    set({
      favoriteListings: mergePendingFavoriteListings(
        listings,
        favoriteListings,
        favoriteIds,
        pendingIds
      ),
    });
  },
  toggleFavorite: async (listingId, listing) => {
    const { favoriteIds, pendingIds } = get();
    if (pendingIds.has(listingId)) return;

    const wasFavorite = favoriteIds.has(listingId);
    const currentListings = get().favoriteListings;
    const previousListing =
      currentListings.find(
        (favoriteListing) => String(favoriteListing.id) === listingId
      ) ?? listing;
    const nextFavoriteIds = new Set(favoriteIds);
    let nextFavoriteListings = currentListings;
    const nextPendingIds = new Set(pendingIds);
    nextPendingIds.add(listingId);

    if (wasFavorite) {
      nextFavoriteIds.delete(listingId);
      nextFavoriteListings = currentListings.filter(
        (favoriteListing) => String(favoriteListing.id) !== listingId
      );
    } else {
      nextFavoriteIds.add(listingId);
      if (
        listing &&
        !currentListings.some(
          (favoriteListing) => String(favoriteListing.id) === listingId
        )
      ) {
        nextFavoriteListings = [...currentListings, listing];
      }
    }

    set({
      favoriteIds: nextFavoriteIds,
      favoriteListings: nextFavoriteListings,
      pendingIds: nextPendingIds,
    });
    get().showToast(
      wasFavorite ? "Removed from Wishlist" : "Added to Wishlist"
    );

    try {
      if (wasFavorite) {
        await removeFavorite(listingId);
      } else {
        await addFavorite(listingId);
      }
    } catch (error) {
      const currentFavoriteIds = new Set(get().favoriteIds);
      const currentFavoriteListings = get().favoriteListings;
      if (wasFavorite) {
        currentFavoriteIds.add(listingId);
      } else {
        currentFavoriteIds.delete(listingId);
      }
      set({
        favoriteIds: currentFavoriteIds,
        favoriteListings: wasFavorite
          ? previousListing &&
            !currentFavoriteListings.some(
              (favoriteListing) => String(favoriteListing.id) === listingId
            )
            ? [...currentFavoriteListings, previousListing]
            : currentFavoriteListings
          : currentFavoriteListings.filter(
              (favoriteListing) => String(favoriteListing.id) !== listingId
            ),
      });
      throw error;
    } finally {
      const currentPendingIds = new Set(get().pendingIds);
      currentPendingIds.delete(listingId);
      set({ pendingIds: currentPendingIds });
    }
  },
}));
