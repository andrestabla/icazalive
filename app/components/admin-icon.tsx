import type { ReactNode } from "react";

export type AdminIconName =
  | "overview"
  | "events"
  | "participants"
  | "analytics"
  | "integrations"
  | "brand"
  | "team"
  | "permissions"
  | "audit"
  | "privacy"
  | "help"
  | "logout"
  | "bell"
  | "alert"
  | "warning"
  | "search"
  | "list"
  | "calendar"
  | "download"
  | "clock"
  | "duplicate"
  | "refresh"
  | "mail"
  | "question"
  | "chat"
  | "reaction"
  | "poll"
  | "upvote"
  | "info"
  | "check"
  | "add"
  | "users"
  | "attendance"
  | "activity"
  | "more"
  | "arrow-right"
  | "close"
  | "event-live"
  | "event-simulated"
  | "event-hybrid"
  | "back";

function IconPaths({ name }: { name: AdminIconName }) {
  const paths: Record<AdminIconName, ReactNode> = {
    overview: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></>,
    events: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h3M8 17h7" /></>,
    participants: <><path d="M16 20v-1.5A4.5 4.5 0 0 0 11.5 14h-4A4.5 4.5 0 0 0 3 18.5V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 3.5a3.3 3.3 0 0 1 0 6.4M21 20v-1.4a4.5 4.5 0 0 0-3.3-4.3" /></>,
    analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /><rect x="3" y="10" width="2" height="10" rx="1" /><rect x="9" y="4" width="2" height="16" rx="1" /><rect x="15" y="13" width="2" height="7" rx="1" /></>,
    integrations: <><path d="M8 12h8M7 7.5 9.5 5a3 3 0 0 1 4.2 4.2L12 11M17 16.5 14.5 19a3 3 0 0 1-4.2-4.2L12 13" /><path d="m6.2 8.8-2.4 2.4a3 3 0 0 0 4.2 4.2l1.2-1.2M17.8 15.2l2.4-2.4A3 3 0 0 0 16 8.6l-1.2 1.2" /></>,
    brand: <><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    team: <><path d="M16 20v-1.5A4.5 4.5 0 0 0 11.5 14h-4A4.5 4.5 0 0 0 3 18.5V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 8v5M14.5 10.5h5" /></>,
    permissions: <><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4M12 15v2" /></>,
    audit: <><path d="M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
    privacy: <><path d="M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6Z" /><path d="M12 10v4M12 17h.01" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9.2a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.9 1.5-1.9 3M12 17h.01" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 16l4-4-4-4M18 12H8" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    alert: <><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v4M12 16h.01" /></>,
    warning: <><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v4M12 16h.01" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    duplicate: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9M4 5v4h4M4 13a8 8 0 0 0 14 4l2-2M20 19v-4h-4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    question: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9.2a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.9 1.5-1.9 3M12 17h.01" /></>,
    chat: <><path d="M5 18.5 3.5 21l4.2-1.5H18a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7.5a3 3 0 0 0 2 2.8Z" /><path d="M8 10h8M8 14h5" /></>,
    reaction: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01" /></>,
    poll: <><path d="M5 20V10M11 20V4M17 20v-7M3 20h18" /><path d="M4 10h2M10 4h2M16 13h2" /></>,
    upvote: <><path d="m12 19V5M6 11l6-6 6 6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    check: <><path d="m5 12 4.3 4.3L19 6.7" /></>,
    add: <><path d="M12 5v14M5 12h14" /></>,
    users: <><path d="M16 20v-1.5A4.5 4.5 0 0 0 11.5 14h-4A4.5 4.5 0 0 0 3 18.5V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 3.5a3.3 3.3 0 0 1 0 6.4M21 20v-1.4a4.5 4.5 0 0 0-3.3-4.3" /></>,
    attendance: <><circle cx="12" cy="12" r="8" /><path d="m8 12 2.5 2.5L16 9" /></>,
    activity: <><path d="M3 12h4l2.3-5 4.4 10 2.1-5H21" /></>,
    more: <><circle cx="5" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r=".8" fill="currentColor" stroke="none" /></>,
    "arrow-right": <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    "event-live": <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /></>,
    "event-simulated": <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>,
    "event-hybrid": <><path d="M7 19v-6a5 5 0 0 1 10 0v6M4 19h16M12 3v3M5.5 6.5l2 2M18.5 6.5l-2 2" /></>,
    back: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
  };

  return paths[name];
}

export function AdminIcon({
  name,
  className = "",
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      className={`admin-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconPaths name={name} />
    </svg>
  );
}