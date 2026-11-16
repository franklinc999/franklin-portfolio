"use client";

import { useEffect, useState } from "react";
import { field } from "@/lib/field/engine";

/**
 * Cycles through a few short phrases in place, each one rolling up to make
 * room for the next. Screen readers get the full list once.
 */
export function Rotator({ items, every = 2400 }: { items: string[]; every?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!field.motionOff) setIndex((i) => (i + 1) % items.length);
    }, every);
    return () => window.clearInterval(id);
  }, [items.length, every]);

  const longest = items.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <span className="rotator">
      <span className="sr-only">{items.join(", ")}</span>
      <span className="rotator-size" aria-hidden="true">
        {longest}
      </span>
      {items.map((item, i) => (
        <span
          key={item}
          className="rotator-item"
          aria-hidden="true"
          data-state={i === index ? "in" : i === (index + items.length - 1) % items.length ? "out" : "wait"}
        >
          {item}
        </span>
      ))}
    </span>
  );
}
