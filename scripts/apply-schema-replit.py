#!/usr/bin/env python3
"""Aplica al schema de Replit (que ya tiene las columnas de Zoom) solo las
adiciones de la biblioteca/emisor/híbrido, sin tocar lo demás. Anclas sobre
fragmentos compartidos por ambas versiones del schema."""

import sys

p = "db/schema.ts"
s = open(p, encoding="utf-8").read()
applied = 0
skipped = 0


def edit(old, new, tag):
    global s, applied, skipped
    if new in s:
        skipped += 1
        return
    if old not in s:
        print(f"FALLO ancla: {tag}")
        sys.exit(1)
    s = s.replace(old, new, 1)
    applied += 1


edit(
    '''export const streamingLatency = pgEnum("streaming_latency", [
  "low",
  "standard",
]);''',
    '''export const streamingLatency = pgEnum("streaming_latency", [
  "low",
  "standard",
]);

export const simulatedDelivery = pgEnum("simulated_delivery", [
  "direct",
  "streaming",
]);

export const emitterStatus = pgEnum("emitter_status", [
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
]);''',
    "enums",
)

edit(
    '''  postEventRedirectUrl: text("post_event_redirect_url"),
  createdBy: uuid("created_by")''',
    '''  postEventRedirectUrl: text("post_event_redirect_url"),
  contentAssetId: uuid("content_asset_id"),
  simulatedDelivery: simulatedDelivery("simulated_delivery")
    .notNull()
    .default("direct"),
  hybridSwitchOffsetMinutes: integer("hybrid_switch_offset_minutes"),
  createdBy: uuid("created_by")''',
    "event columns",
)

edit(
    '''    technicalCheckAt: timestamp("technical_check_at", { withTimezone: true }),''',
    '''    technicalCheckAt: timestamp("technical_check_at", { withTimezone: true }),
    emitterStatus: emitterStatus("emitter_status").notNull().default("idle"),
    emitterTaskArn: text("emitter_task_arn"),
    emitterStartedAt: timestamp("emitter_started_at", { withTimezone: true }),''',
    "session columns",
)

edit(
    "export type Event = typeof events.$inferSelect;",
    '''export const contentAssets = pgTable(
  "content_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    s3Key: text("s3_key").notNull().unique(),
    sizeBytes: integer("size_bytes"),
    durationSeconds: integer("duration_seconds"),
    contentType: text("content_type").notNull().default("video/mp4"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("content_assets_created_idx").on(table.createdAt)],
);

export type ContentAsset = typeof contentAssets.$inferSelect;
export type Event = typeof events.$inferSelect;''',
    "content_assets table",
)

open(p, "w", encoding="utf-8").write(s)
print(f"OK schema: {applied} aplicada(s), {skipped} ya presente(s)")
