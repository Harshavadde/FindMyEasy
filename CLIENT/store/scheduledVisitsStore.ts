import { create } from "zustand";

import type { NewScheduledVisit, ScheduledVisit } from "../types/visit";

type ScheduledVisitsState = {
  visits: ScheduledVisit[];
  addVisit: (visit: NewScheduledVisit) => void;
};

export const useScheduledVisitsStore = create<ScheduledVisitsState>((set) => ({
  visits: [],
  addVisit: (visit) =>
    set((state) => ({
      visits: [
        {
          ...visit,
          id: `${Date.now()}`,
          status: "Saved this session",
          createdAt: new Date().toISOString(),
        },
        ...state.visits,
      ],
    })),
}));
