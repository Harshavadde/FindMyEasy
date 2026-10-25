import { create } from "zustand";
import {
  addFavorite,
  getFavoriteIds,
  removeFavorite,
} from "../services/favorites";

type FavoritesState = {
  favoriteIds: Set<string>;
  pendingIds: Set<string>;
  hasLoaded: boolean;
  loadFavoriteIds: () => Promise<void>;
  toggleFavorite: (listingId: string) => Promise<void>;
};

let favoriteIdsRequest: Promise<void> | null = null;

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: new Set(),
  pendingIds: new Set(),
  hasLoaded: false,
  loadFavoriteIds: () => {
    if (get().hasLoaded) return Promise.resolve();
    if (favoriteIdsRequest) return favoriteIdsRequest;

    favoriteIdsRequest = getFavoriteIds()
      .then((ids) => {
        const { favoriteIds, pendingIds } = get();
        const nextFavoriteIds = new Set(ids);

        pendingIds.forEach((id) => {
          if (favoriteIds.has(id)) {
            nextFavoriteIds.add(id);
          } else {
            nextFavoriteIds.delete(id);
          }
        });

        set({ favoriteIds: nextFavoriteIds, hasLoaded: true });
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
  toggleFavorite: async (listingId) => {
    const { favoriteIds, pendingIds } = get();
    if (pendingIds.has(listingId)) return;

    const wasFavorite = favoriteIds.has(listingId);
    const nextFavoriteIds = new Set(favoriteIds);
    const nextPendingIds = new Set(pendingIds);
    nextPendingIds.add(listingId);

    if (wasFavorite) {
      nextFavoriteIds.delete(listingId);
    } else {
      nextFavoriteIds.add(listingId);
    }

    set({
      favoriteIds: nextFavoriteIds,
      pendingIds: nextPendingIds,
    });

    try {
      if (wasFavorite) {
        await removeFavorite(listingId);
      } else {
        await addFavorite(listingId);
      }
    } catch (error) {
      const currentFavoriteIds = new Set(get().favoriteIds);
      if (wasFavorite) {
        currentFavoriteIds.add(listingId);
      } else {
        currentFavoriteIds.delete(listingId);
      }
      set({ favoriteIds: currentFavoriteIds });
      throw error;
    } finally {
      const currentPendingIds = new Set(get().pendingIds);
      currentPendingIds.delete(listingId);
      set({ pendingIds: currentPendingIds });
    }
  },
}));
