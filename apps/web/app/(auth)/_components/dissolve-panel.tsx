"use client"

import { useEffect, useRef, useState } from "react"

export type DissolveSlide = {
  image: string
  title: string
  body: string
}

// Ported from the CodeSandbox organisation wizard: a band of random glyphs
// sweeps down the panel on a canvas while the outgoing image is clipped away
// behind it, so one photo appears to disintegrate into the next.
const CELL = 16
const SPREAD_A = 0.25
const SPREAD_B = 0.25
const SCATTER = 0.15
const CORE_R = 0.025
const MIN_SC = 0.3
const VIS_THR = 0.65
const RANGE = 1 + SPREAD_A + SPREAD_B
const DURATION = 1400
const INTERVAL = 5200
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%*+=?!~<>[]{}|"
const BAND = "#0b5d34"
const GLYPH = "#f4f1ec"

function hash(row: number, col: number, seed: number) {
  const value = Math.sin(row * seed + col * (seed * 2.45)) * 43758.5453
  return value - Math.floor(value)
}

function clamp(value: number, lo: number, hi: number) {
  return value < lo ? lo : value > hi ? hi : value
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/** Fully covered: the state every slide sits in except the one on top. */
const HIDDEN_CLIP = "polygon(0% 100%,100% 100%,100% 100%,0% 100%)"

export function DissolvePanel({ slides }: { slides: DissolveSlide[] }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas || slides.length < 2) return

    // Honour the OS setting: the sweep is a large, fast-moving effect.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (motion.matches) return

    const layers = Array.from(
      host.querySelectorAll<HTMLElement>("[data-slide]"),
    )
    if (layers.length < 2) return

    const context = canvas.getContext("2d")
    if (!context) return

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let total = 0
    let cellNormalY = new Float32Array(0)
    let cellVisibility = new Float32Array(0)
    let cellScatter = new Float32Array(0)
    let cellChar = new Uint8Array(0)
    let cellX = new Uint16Array(0)
    let cellY = new Uint16Array(0)
    let frame = 0

    function measure() {
      const box = host!.getBoundingClientRect()
      width = Math.ceil(box.width)
      height = Math.ceil(box.height)
      if (!width || !height) return false

      // Draw at device resolution so the glyphs stay crisp, but keep the
      // arithmetic below in CSS pixels.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.ceil(width * dpr)
      canvas!.height = Math.ceil(height * dpr)
      context!.setTransform(dpr, 0, 0, dpr, 0, 0)
      context!.font = `bold ${Math.round(CELL * 0.72)}px ui-monospace, monospace`
      context!.textAlign = "center"
      context!.textBaseline = "middle"

      cols = Math.ceil(width / CELL)
      rows = Math.ceil(height / CELL)
      total = cols * rows

      cellNormalY = new Float32Array(total)
      cellVisibility = new Float32Array(total)
      cellScatter = new Float32Array(total)
      cellChar = new Uint8Array(total)
      cellX = new Uint16Array(total)
      cellY = new Uint16Array(total)

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col
          cellX[index] = col * CELL
          cellY[index] = row * CELL
          cellNormalY[index] = (row + 0.5) / rows
          cellVisibility[index] = hash(row, col, 127.1)
          cellScatter[index] = (hash(row, col, 269.3) - 0.5) * SCATTER
          cellChar[index] = Math.floor(Math.random() * CHARS.length)
        }
      }
      return true
    }

    function renderBand(bandY: number) {
      context!.clearRect(0, 0, width, height)
      const refresh = ++frame % 4 === 0
      for (let index = 0; index < total; index++) {
        const normalY = cellNormalY[index]!
        const softness = clamp(
          Math.abs(normalY - bandY) / CORE_R,
          MIN_SC,
          1,
        )
        const offset = normalY - bandY + cellScatter[index]! * softness
        const distance =
          offset >= 0 ? offset / SPREAD_B : Math.abs(offset) / SPREAD_A
        if (distance >= 1) continue
        if ((1 - distance) ** 2 <= cellVisibility[index]! * VIS_THR) continue

        if (refresh) cellChar[index] = Math.floor(Math.random() * CHARS.length)
        const x = cellX[index]!
        const y = cellY[index]!
        context!.fillStyle = BAND
        context!.fillRect(x, y, CELL, CELL)
        context!.fillStyle = GLYPH
        context!.fillText(
          CHARS[cellChar[index]!]!,
          x + CELL * 0.5,
          y + CELL * 0.5 + 1,
        )
      }
    }

    layers.forEach((layer, index) => {
      layer.style.willChange = "clip-path"
      layer.style.zIndex = String(index === 0 ? layers.length : 1)
      layer.style.clipPath = index === 0 ? "" : HIDDEN_CLIP
    })

    let current = 0
    let animating = false
    let rafId = 0

    function advance() {
      if (animating || document.hidden || !total) return
      animating = true

      const previous = layers[current]!
      const nextIndex = (current + 1) % layers.length
      const next = layers[nextIndex]!

      next.style.clipPath = ""
      next.style.zIndex = String(layers.length - 1)
      previous.style.zIndex = String(layers.length)

      let start = 0
      const step = (now: number) => {
        if (!start) start = now
        const t = clamp((now - start) / DURATION, 0, 1)
        const band = -SPREAD_A + ease(t) * RANGE
        // The outgoing image is erased from the top down, exactly level with
        // the band, so the glyphs read as the edge doing the erasing.
        const pct = clamp(band * 100, 0, 100).toFixed(1)
        previous.style.clipPath = `polygon(0% ${pct}%, 100% ${pct}%, 100% 100%, 0% 100%)`
        renderBand(band)

        if (t < 1) {
          rafId = requestAnimationFrame(step)
          return
        }

        context!.clearRect(0, 0, width, height)
        previous.style.clipPath = HIDDEN_CLIP
        previous.style.zIndex = "1"
        next.style.zIndex = String(layers.length)
        current = nextIndex
        animating = false
        setActive(nextIndex)
      }

      rafId = requestAnimationFrame(step)
    }

    let timer = 0
    const startTimer = () => {
      if (measure()) timer = window.setInterval(advance, INTERVAL)
    }

    // The panel can still be laying out on the first frame after mount.
    if (measure()) {
      timer = window.setInterval(advance, INTERVAL)
    } else {
      rafId = requestAnimationFrame(startTimer)
    }

    const observer = new ResizeObserver(() => {
      if (animating) return
      measure()
    })
    observer.observe(host)

    return () => {
      window.clearInterval(timer)
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [slides.length])

  const caption = slides[active] ?? slides[0]

  return (
    <div ref={hostRef} className="relative size-full overflow-hidden bg-[#12261c]">
      {slides.map((slide, index) => (
        <div
          key={slide.image}
          data-slide={index}
          className="absolute inset-0"
          style={index === 0 ? undefined : { clipPath: HIDDEN_CLIP }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="size-full object-cover"
          />
        </div>
      ))}

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[100] size-full"
      />

      <div className="pointer-events-none absolute inset-0 z-[101] bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {caption ? (
        <div className="absolute inset-x-0 bottom-0 z-[102] p-10 text-white">
          <h2 className="max-w-[22ch] text-[28px] leading-tight font-semibold tracking-[-0.02em]">
            {caption.title}
          </h2>
          <p className="mt-3 max-w-[42ch] text-[15px] leading-6 text-white/85">
            {caption.body}
          </p>
        </div>
      ) : null}
    </div>
  )
}
