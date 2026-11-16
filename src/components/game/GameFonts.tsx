"use client";

import { useEffect } from "react";

const FACES = [
  "400 16px 'Instrument Serif'",
  "italic 400 16px 'Instrument Serif'",
  "500 16px 'JetBrains Mono'",
  "600 16px 'JetBrains Mono'",
];

/** Canvas text does not reliably start a font download, so ask for the game's faces up front. */
export function GameFonts() {
  useEffect(() => {
    for (const face of FACES) document.fonts?.load(face).catch(() => {});
  }, []);
  return null;
}
