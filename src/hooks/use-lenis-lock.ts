"use client";

import { useEffect } from "react";
import { useLenis } from "@/components/providers/smooth-scroll";

/** Pause smooth scrolling while a modal surface is open (Radix locks native scroll only). */
export function useLenisLock(locked: boolean) {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [lenis, locked]);
}
