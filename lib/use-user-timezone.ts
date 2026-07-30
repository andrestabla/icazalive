"use client";

import { useEffect, useState } from "react";

export const FALLBACK_TIMEZONE = "America/Bogota";

let cachedPreference: string | null | undefined;
let pending: Promise<string | null> | null = null;

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
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
