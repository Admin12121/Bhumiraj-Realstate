"use client"

import { useEffect, useRef } from "react"

/**
 * Port of the CodeSandbox `components/media/hover-grid.html` effect, used there
 * on the hub page's imagery. The cursor lights the single nearest block, then a
 * short random chain of its neighbours, each a beat later.
 */
const SYMBOLS = ["O", "X", "*", ">", "$", "W"]
const BLOCK_SIZE = 25
const DETECTION_RADIUS = 50
const CLUSTER_SIZE = 7
const BLOCK_LIFETIME = 300
const EMPTY_RATIO = 0.3
const SCRAMBLE_RATIO = 0.25
const SCRAMBLE_INTERVAL = 150

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!
}

type Block = {
  el: HTMLDivElement
  x: number
  y: number
  gx: number
  gy: number
  highlightEnd: number
  isEmpty: boolean
  scramble: boolean
  scrambleTimer: ReturnType<typeof setInterval> | null
}

export function HeroGrid() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Pointer-driven decoration: nothing to show on touch, and it is motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!window.matchMedia("(hover: hover)").matches) return

    let cleanup: (() => void) | null = null

    function buildGrid() {
      cleanup?.()

      const width = root!.offsetWidth
      const height = root!.offsetHeight
      if (!width || !height) return

      const overlay = document.createElement("div")
      overlay.dataset["slot"] = "hero-grid-overlay"

      const cols = Math.ceil(width / BLOCK_SIZE)
      const rows = Math.ceil(height / BLOCK_SIZE)
      const blocks: Block[] = []

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isEmpty = Math.random() < EMPTY_RATIO
          const el = document.createElement("div")
          el.dataset["slot"] = "hero-grid-block"
          el.style.width = `${BLOCK_SIZE}px`
          el.style.height = `${BLOCK_SIZE}px`
          el.style.left = `${col * BLOCK_SIZE}px`
          el.style.top = `${row * BLOCK_SIZE}px`
          if (!isEmpty) el.textContent = randomSymbol()
          overlay.appendChild(el)

          blocks.push({
            el,
            x: col * BLOCK_SIZE + BLOCK_SIZE / 2,
            y: row * BLOCK_SIZE + BLOCK_SIZE / 2,
            gx: col,
            gy: row,
            highlightEnd: 0,
            isEmpty,
            scramble: !isEmpty && Math.random() < SCRAMBLE_RATIO,
            scrambleTimer: null,
          })
        }
      }
      root!.appendChild(overlay)

      const activate = (block: Block, extraDelay: number) => {
        block.el.dataset["state"] = "active"
        block.highlightEnd = Date.now() + BLOCK_LIFETIME + extraDelay
        if (block.scramble && !block.scrambleTimer) {
          block.scrambleTimer = setInterval(() => {
            block.el.textContent = randomSymbol()
          }, SCRAMBLE_INTERVAL)
        }
      }

      const onMove = (event: PointerEvent) => {
        const rect = root!.getBoundingClientRect()
        const mx = event.clientX - rect.left
        const my = event.clientY - rect.top

        let closest: Block | null = null
        let closestDist = Infinity
        for (const block of blocks) {
          const dx = mx - block.x
          const dy = my - block.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < closestDist) {
            closestDist = distance
            closest = block
          }
        }
        if (!closest || closestDist > DETECTION_RADIUS) return

        activate(closest, 0)

        // Walk a random chain of neighbours out from the nearest block; the
        // staggered delay is what makes the cluster look like it spreads.
        const clusterCount = Math.floor(Math.random() * CLUSTER_SIZE) + 1
        let current = closest
        const active: Block[] = [closest]
        for (let step = 0; step < clusterCount; step++) {
          const neighbours = blocks.filter(
            (candidate) =>
              !active.includes(candidate) &&
              Math.abs(candidate.gx - current.gx) <= 1 &&
              Math.abs(candidate.gy - current.gy) <= 1,
          )
          if (neighbours.length === 0) break
          const pick = neighbours[Math.floor(Math.random() * neighbours.length)]!
          activate(pick, step * 10)
          active.push(pick)
          current = pick
        }
      }

      // Listening on the section, not the overlay: the headline sits above this
      // layer and would otherwise swallow the pointer across the middle.
      const surface = root!.parentElement ?? root!
      surface.addEventListener("pointermove", onMove)

      let raf = 0
      const tick = () => {
        const now = Date.now()
        for (const block of blocks) {
          if (block.highlightEnd > 0 && now > block.highlightEnd) {
            delete block.el.dataset["state"]
            block.highlightEnd = 0
            if (block.scrambleTimer) {
              clearInterval(block.scrambleTimer)
              block.scrambleTimer = null
              if (!block.isEmpty) block.el.textContent = randomSymbol()
            }
          }
        }
        raf = requestAnimationFrame(tick)
      }
      tick()

      cleanup = () => {
        surface.removeEventListener("pointermove", onMove)
        if (raf) cancelAnimationFrame(raf)
        for (const block of blocks) {
          if (block.scrambleTimer) clearInterval(block.scrambleTimer)
        }
        overlay.remove()
      }
    }

    buildGrid()

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(buildGrid, 150)
    })
    observer.observe(root)

    return () => {
      observer.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
      cleanup?.()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-slot="hero-grid"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  )
}
