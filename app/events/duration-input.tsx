"use client";

import { useState } from "react";

// Duración del evento en minutos: cualquier valor entre 5 y 720, con
// sugerencias rápidas. Se usa al crear el evento y al cambiar su fecha.
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export default function DurationInput({
  name,
  value,
  onChange,
  disabled,
  id = "event-duration",
}: {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const listId = `${id}-presets`;
  const [inner, setInner] = useState(value ?? "60");
  const current = value ?? inner;
  const minutes = Number(current);
  return (
    <span className="duration-input">
      <input
        id={id}
        name={name}
        type="number"
        min={5}
        max={720}
        step={1}
        inputMode="numeric"
        list={listId}
        value={current}
        disabled={disabled}
        onChange={(input) => {
          setInner(input.target.value);
          onChange?.(input.target.value);
        }}
        aria-describedby={`${id}-hint`}
      />
      <datalist id={listId}>
        {DURATION_PRESETS.map((preset) => (
          <option value={preset} key={preset} label={formatDuration(preset)} />
        ))}
      </datalist>
      <small id={`${id}-hint`}>
        {Number.isFinite(minutes) && minutes >= 5 ? `minutos · ${formatDuration(minutes)}` : "minutos (5 a 720)"}
      </small>
    </span>
  );
}
