"use client"

import { useCallback, useState, type ChangeEvent } from "react"

/**
 * Keeps a range slider and its two number inputs in step. Inputs stay free-text
 * while typing and are clamped on blur/Enter so a partial number is not fought.
 */
export function useSliderWithInput({
  minValue,
  maxValue,
  initialValue,
}: {
  minValue: number
  maxValue: number
  initialValue: number[]
}) {
  const [sliderValue, setSliderValue] = useState<number[]>(initialValue)
  const [inputValues, setInputValues] = useState<string[]>(
    initialValue.map(String),
  )

  const handleSliderChange = useCallback((values: number[]) => {
    setSliderValue(values)
    setInputValues(values.map(String))
  }, [])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, index: number) => {
      const raw = event.target.value.replace(/[^\d]/g, "")
      setInputValues((current) =>
        current.map((value, position) => (position === index ? raw : value)),
      )
    },
    [],
  )

  const validateAndUpdateValue = useCallback(
    (raw: string, index: number) => {
      const parsed = Number(raw)
      const fallback = sliderValue[index] ?? minValue
      let next = Number.isFinite(parsed) && raw !== "" ? parsed : fallback
      next = Math.min(maxValue, Math.max(minValue, next))

      // Keep the pair ordered so the track never inverts.
      const paired = [...sliderValue]
      paired[index] = next
      if (index === 0 && next > (paired[1] ?? maxValue)) paired[0] = paired[1] ?? maxValue
      if (index === 1 && next < (paired[0] ?? minValue)) paired[1] = paired[0] ?? minValue

      setSliderValue(paired)
      setInputValues(paired.map(String))
    },
    [maxValue, minValue, sliderValue],
  )

  return {
    sliderValue,
    inputValues,
    handleSliderChange,
    handleInputChange,
    validateAndUpdateValue,
  }
}
