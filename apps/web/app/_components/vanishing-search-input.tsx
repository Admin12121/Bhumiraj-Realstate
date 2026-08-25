"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { NEPAL_PROVINCES } from "@real-estate/contracts";

import { cn } from "@/lib/utils";

const PLACEHOLDERS = [
  "Kathmandu",
  "2BHK flat in Lalitpur",
  "Land in Bhaktapur",
  "House in Pokhara",
  "Office space in Baneshwor",
  "Shop in Thamel",
  "Apartment near Patan Durbar",
  "Warehouse in Birgunj",
];

/** Every district, for the suggestion list. */
function allDistricts(): string[] {
  return NEPAL_PROVINCES.flatMap((province) => [...province.districts]);
}

type Particle = { x: number; y: number; r: number; color: string };

/**
 * The location field. Placeholders cycle while it is empty, and submitting
 * scatters the typed text so the search reads as an action rather than a jump.
 */
export function VanishingSearchInput({
  value,
  onValueChange,
  onSubmit,
  id,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  id?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const [placeholder, setPlaceholder] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const districts = useMemo(() => allDistricts(), []);
  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return [];
    return districts
      .filter((district) => district.toLowerCase().includes(term))
      .slice(0, 6);
  }, [districts, value]);

  useEffect(() => {
    if (value) return;
    const timer = setInterval(
      () => setPlaceholder((current) => (current + 1) % PLACEHOLDERS.length),
      2400,
    );
    return () => clearInterval(timer);
  }, [value]);

  /** Samples the typed text into pixels the animation can scatter. */
  const sample = useCallback(() => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    if (!input || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = input.offsetWidth || 400;
    const height = input.offsetHeight || 48;
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const styles = getComputedStyle(input);
    const size = Number.parseFloat(styles.fontSize) || 14;
    context.font = `${styles.fontWeight} ${size * scale}px ${styles.fontFamily}`;
    context.fillStyle = styles.color;
    context.textBaseline = "middle";
    context.fillText(value, 0, canvas.height / 2);

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const found: Particle[] = [];
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const index = (y * canvas.width + x) * 4;
        if ((data[index + 3] ?? 0) > 24) {
          found.push({
            x,
            y,
            r: 1,
            color: `rgba(${data[index]},${data[index + 1]},${data[index + 2]},${(data[index + 3] ?? 0) / 255})`,
          });
        }
      }
    }
    particles.current = found;
  }, [value]);

  function scatter() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const step = (frontier: number) => {
      requestAnimationFrame(() => {
        const next: Particle[] = [];
        for (const particle of particles.current) {
          if (particle.x < frontier) {
            next.push(particle);
            continue;
          }
          if (particle.r <= 0) continue;
          particle.x += Math.random() > 0.5 ? 1 : -1;
          particle.y += Math.random() > 0.5 ? 1 : -1;
          particle.r -= 0.05 * Math.random();
          next.push(particle);
        }
        particles.current = next;

        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const particle of next) {
          if (particle.x <= frontier) continue;
          context.fillStyle = particle.color;
          context.fillRect(particle.x, particle.y, particle.r, particle.r);
        }

        if (next.length > 0) {
          step(frontier - 8);
        } else {
          setAnimating(false);
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
    };

    const rightmost = particles.current.reduce(
      (far, particle) => Math.max(far, particle.x),
      0,
    );
    step(rightmost);
  }

  function submit() {
    if (animating) return;
    setOpen(false);
    if (value.trim()) {
      sample();
      setAnimating(true);
      scatter();
    }
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(
          (current) => (current - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" && suggestions[active]) {
        event.preventDefault();
        onValueChange(suggestions[active]);
        setOpen(false);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <canvas
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full",
          animating ? "opacity-100" : "opacity-0",
        )}
        ref={canvasRef}
      />
      <input
        aria-autocomplete="list"
        aria-controls={`${id ?? "search"}-suggestions`}
        aria-expanded={open && suggestions.length > 0}
        autoComplete="off"
        className={cn(
          className,
          animating && "text-transparent placeholder:text-transparent",
        )}
        id={id}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        role="combobox"
        value={value}
      />

      {/* Cycles only while empty, so it never competes with what is typed. */}
      {!value && !animating ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-[14px] text-[#737373]"
          key={placeholder}
          style={{ animation: "placeholder-rise 340ms ease-out" }}
        >
          {PLACEHOLDERS[placeholder]}
        </span>
      ) : null}

      {open && suggestions.length > 0 ? (
        <ul
          className="absolute top-[calc(100%+8px)] left-0 z-50 m-0 w-full min-w-[220px] list-none overflow-hidden rounded-xl border bg-popover p-1 shadow-lg"
          id={`${id ?? "search"}-suggestions`}
          role="listbox"
        >
          {suggestions.map((district, index) => (
            <li key={district}>
              <button
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm",
                  index === active ? "bg-accent" : "hover:bg-accent",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onValueChange(district);
                  setOpen(false);
                }}
                onMouseEnter={() => setActive(index)}
                type="button"
              >
                {district}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
