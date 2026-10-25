"use client";

import { create } from "zustand";

/** True while the home page's dark video hero is mounted: the header over it keeps its dark look until scrolled. */
export const useDarkHero = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({ on: false, set: (on) => set({ on }) }));
