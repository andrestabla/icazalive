"use client";

import { useEffect, useState } from "react";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

export const FALLBACK_TIMEZONE = PLATFORM_TIMEZONE;

let cachedPreference: string | null | undefined;
let pending: Promise<string | null> | null = null;

// La plataforma opera en una sola zona horaria (Miami); la preferencia
// personal del usuario, si la guardó, sigue teniendo prioridad.
// La plataforma opera en una sola zona horaria (Miami); la preferencia
// personal del usuario, si la guardó, sigue teniendo prioridad.
// La plataforma opera en una sola zona horaria (Miami); la preferencia
// personal del usuario, si la guardó, sigue teniendo prioridad.
function browserTimezone(): string {
  return PLATFORM_TIMEZONE;
}

async function loadPreference(): Promise<string | null> {
  if (cachedPreference !== undefined) return cachedPreference;
  pending ??= fetch("/api/auth/me")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { data?: { timezone?: string | null } } | null) => {
      cachedPreference = payload?.data?.timezone ?? null;
      return cachedPreference;
    })
    .catch(() => {
      cachedPreference = null;
      return null;
    });
  return pending;
}

export function invalidateUserTimezone(next: string | null) {
  cachedPreference = next;
  pending = null;
}

// Zona horaria efectiva del usuario: su preferencia guardada o, en su
// ausencia, la zona del navegador.
export function useUserTimezone(): string {
  const [timezone, setTimezone] = useState(browserTimezone);

  useEffect(() => {
    let cancelled = false;
    void loadPreference().then((preference) => {
      if (!cancelled && preference) setTimezone(preference);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return timezone;
}
