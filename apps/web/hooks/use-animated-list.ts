"use client"

import { useState } from "react"

export type AnimatedEntry<T> = {
  item: T
  key: string
  /** Entries on their way out keep rendering until their animation finishes. */
  exiting: boolean
  /** Stagger index, so removals cascade rather than vanishing together. */
  order: number
}

/**
 * Keeps removed items on screen long enough to animate out, so a changing list
 * never swaps wholesale. Entering items mount fresh and animate via CSS; leaving
 * items are held here, staggered, and dropped once their animation reports back.
 */
export function useAnimatedList<T>(
  items: T[],
  keyOf: (item: T) => string,
): {
  entries: AnimatedEntry<T>[]
  onExited: (key: string) => void
} {
  const [exiting, setExiting] = useState<Map<string, T>>(new Map())
  const [tracked, setTracked] = useState<{
    signature: string
    items: Map<string, T>
  }>({ signature: "", items: new Map() })

  const current = new Map(items.map((item) => [keyOf(item), item]))
  const signature = [...current.keys()].join("|")

  // Adjusting during render costs less than an effect and avoids a frame where
  // the removed cards have already vanished before their animation could run.
  if (signature !== tracked.signature) {
    const departed = new Map<string, T>()
    for (const [key, item] of tracked.items) {
      if (!current.has(key)) departed.set(key, item)
    }

    setExiting((live) => {
      const merged = new Map(live)
      // Anything that came back is no longer leaving.
      for (const key of current.keys()) merged.delete(key)
      for (const [key, item] of departed) merged.set(key, item)
      return merged
    })
    setTracked({ signature, items: current })
  }

  const entries: AnimatedEntry<T>[] = items.map((item, index) => ({
    item,
    key: keyOf(item),
    exiting: false,
    order: index,
  }))

  let order = 0
  for (const [key, item] of exiting) {
    if (current.has(key)) continue
    entries.push({ item, key, exiting: true, order: order++ })
  }

  function onExited(key: string) {
    setExiting((live) => {
      if (!live.has(key)) return live
      const next = new Map(live)
      next.delete(key)
      return next
    })
  }

  return { entries, onExited }
}
