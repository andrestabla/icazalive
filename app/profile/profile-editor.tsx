"use client";

import { useRef, useState, type FormEvent } from "react";
import AccountSecurity from "@/app/components/account-security";
import { useFeedbackSetter } from "@/lib/feedback";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/locale";
import { invalidateUserTimezone } from "@/lib/use-user-timezone";

type Profile = {
  name: string;
  email: string;
  role: "administrator" | "organizer" | "participant";
  timezone: string | null;
  schedulingUrl: string | null;
  locale: Locale;
  avatarUrl: string | null;
  avatarSource: string | null;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string;
};

const ROLE_LABELS = { administrator: "Administrador", organizer: "Organizador", participant: "Participante" };
const TIMEZONE_CHOICES = [
  "America/New_York", "America/Bogota", "America/Mexico_City", "America/Lima", "America/Guayaquil",
  "America/Panama", "America/Santiago", "America/Argentina/Buenos_Aires", "America/Sao_Paulo",
  "America/Chicago", "America/Los_Angeles", "Europe/Madrid", "Europe/Paris", "Europe/London", "UTC",
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function ProfileEditor({ profile: initial }: { profile: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone ?? "");
  const [schedulingUrl, setSchedulingUrl] = useState(initial.schedulingUrl ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [, setMessageState] = useState("");
  const setMessage = useFeedbackSetter(setMessageState);
  const [, setErrorState] = useState("");
  const setError = useFeedbackSetter(setErrorState, "error");
  const fileInput = useRef<HTMLInputElement>(null);

  const patchProfile = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { name: string; locale: Locale; avatarUrl: string | null; avatarSource: string | null };
      error?: string;
    };
    if (!response.ok || !payload.data) {
      setError(payload.error ?? "No fue posible guardar el perfil.");
      return null;
    }
    setProfile((current) => ({ ...current, ...payload.data! }));
    return payload.data;
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("name");
    const result = await patchProfile({ name });
    if (result) setMessage("Tu nombre quedó actualizado.");
    setSaving(null);
  };

  const changeLocale = async (locale: Locale) => {
    if (locale === profile.locale) return;
    setSaving("locale");
    const result = await patchProfile({ locale });
    if (result) {
      try { window.localStorage.setItem("icaza_locale", locale); } catch { /* sin almacenamiento */ }
      window.location.reload();
      return;
    }
    setSaving(null);
  };

  const savePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("preferences");
    const response = await fetch("/api/auth/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timezone: timezone || null,
        ...(profile.role !== "participant" ? { schedulingUrl: schedulingUrl || null } : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      invalidateUserTimezone(timezone || null);
      setMessage("Preferencias guardadas.");
    } else {
      setError(payload.error ?? "No fue posible guardar las preferencias.");
    }
    setSaving(null);
  };

  const uploadPhoto = async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setError("Elige una imagen PNG, JPG, WEBP o GIF.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("La foto no puede superar 3 MB.");
      return;
    }
    setSaving("photo");
    setUploadPct(0);
    const presign = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "avatars", filename: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    const payload = (await presign.json().catch(() => ({}))) as { data?: { uploadUrl: string; key: string }; error?: string };
    if (!presign.ok || !payload.data) {
      setError(payload.error ?? "No fue posible preparar la subida.");
      setSaving(null);
      setUploadPct(null);
      return;
    }
    const { uploadUrl, key } = payload.data;
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("content-type", file.type);
      xhr.upload.onprogress = (progress) => {
        if (progress.lengthComputable) setUploadPct(Math.round((progress.loaded / progress.total) * 100));
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (!uploaded) {
      setError("La subida de la foto falló. Inténtalo de nuevo.");
      setSaving(null);
      setUploadPct(null);
      return;
    }
    const result = await patchProfile({ avatarKey: key });
    if (result) setMessage("Tu foto de perfil quedó actualizada.");
    setSaving(null);
    setUploadPct(null);
  };

  const removePhoto = async () => {
    setSaving("photo");
    const result = await patchProfile({ removeAvatar: true });
    if (result) setMessage("Foto de perfil retirada.");
    setSaving(null);
  };

  return (
    <>
      <header className="module-header">
        <div>
          <p className="eyebrow">MI CUENTA</p>
          <h1>Mi perfil</h1>
          <p>Tus datos, tu foto y cómo prefieres usar la plataforma.</p>
        </div>
      </header>

      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DATOS</p>
              <h2>Identidad</h2>
              <p>Así te ven los demás miembros del equipo y los participantes.</p>
            </div>
          </div>
          <div className="profile-photo">
            <div className="profile-photo-frame">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials(profile.name)}
            </div>
            <div className="profile-photo-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(input) => {
                  const file = input.target.files?.[0];
                  input.target.value = "";
                  if (file) void uploadPhoto(file);
                }}
              />
              <button type="button" className="primary-button" disabled={saving === "photo"} onClick={() => fileInput.current?.click()}>
                {uploadPct !== null ? `Subiendo… ${uploadPct}%` : profile.avatarUrl ? "Cambiar foto" : "Subir foto"}
              </button>
              {profile.avatarUrl && (
                <button type="button" className="secondary-action" disabled={saving === "photo"} onClick={() => void removePhoto()}>
                  Quitar foto
                </button>
              )}
              <small>
                {profile.avatarSource === "google"
                  ? "Foto sincronizada desde tu cuenta de Google. Si subes una propia, se mantendrá."
                  : "PNG, JPG, WEBP o GIF de hasta 3 MB."}
              </small>
            </div>
          </div>
          <form className="profile-form" onSubmit={saveName}>
            <label>
              Nombre completo
              <input value={name} onChange={(input) => setName(input.target.value)} minLength={2} maxLength={100} required autoComplete="name" />
            </label>
            <label>
              Correo electrónico
              <input value={profile.email} readOnly />
              <small>El correo de acceso lo cambia un administrador desde Equipo.</small>
            </label>
            <label>
              Rol
              <input value={ROLE_LABELS[profile.role]} readOnly />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={saving === "name" || name.trim() === profile.name}>
                {saving === "name" ? "Guardando…" : "Guardar nombre"}
              </button>
            </div>
          </form>
        </section>

        <div className="profile-card">
          <section className="panel profile-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PREFERENCIAS</p>
                <h2>Idioma de la plataforma</h2>
                <p>Se aplica a toda la interfaz y se recuerda en tus próximos ingresos.</p>
              </div>
            </div>
            <div className="profile-language" role="group" aria-label="Idioma">
              {(Object.keys(LOCALE_LABELS) as Locale[]).map((locale) => (
                <button
                  type="button"
                  key={locale}
                  className={profile.locale === locale ? "active" : ""}
                  disabled={saving === "locale"}
                  onClick={() => void changeLocale(locale)}
                  translate="no"
                >
                  {LOCALE_LABELS[locale]}
                </button>
              ))}
            </div>
          </section>

          <section className="panel profile-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ZONA HORARIA Y AGENDA</p>
                <h2>Cómo ves las fechas</h2>
              </div>
            </div>
            <form className="profile-form" onSubmit={savePreferences}>
              <label>
                Zona horaria para fechas administrativas
                <select value={timezone} onChange={(input) => setTimezone(input.target.value)}>
                  <option value="">Automática (zona del navegador)</option>
                  {TIMEZONE_CHOICES.map((zone) => (
                    <option value={zone} key={zone}>{zone.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              {profile.role !== "participant" && (
                <label>
                  Enlace de agendamiento (Calendly)
                  <input value={schedulingUrl} onChange={(input) => setSchedulingUrl(input.target.value)} placeholder="https://calendly.com/tu-usuario/reunion" inputMode="url" />
                  <small>Aparece como botón “Agendar una reunión” en los correos de seguimiento de tus eventos.</small>
                </label>
              )}
              <div className="form-actions">
                <button className="primary-button" disabled={saving === "preferences"}>
                  {saving === "preferences" ? "Guardando…" : "Guardar preferencias"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel profile-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SEGURIDAD</p>
                <h2>Contraseña y verificación</h2>
              </div>
            </div>
            <div className="profile-security">
              <p>{profile.hasPassword ? "Cambia tu contraseña o activa la verificación en dos pasos." : "Entras con Google. Puedes activar la verificación en dos pasos."}</p>
              <AccountSecurity />
            </div>
            <div className="profile-meta">
              <p><span>Cuenta creada</span><b>{profile.createdAt}</b></p>
              <p><span>Último acceso</span><b>{profile.lastLoginAt}</b></p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
