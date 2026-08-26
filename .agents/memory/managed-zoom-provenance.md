---
name: Managed Zoom provenance
description: Safety boundary for storing and remotely modifying Zoom meeting associations.
---

Only a meeting created successfully through the managed Zoom connector may be remotely updated or deleted later. Associations that existed before provenance tracking, or were entered manually, remain local-only and must not trigger remote mutation.

**Why:** A stored meeting ID alone does not prove that it belongs to the session; allowing it to drive connector calls can modify or delete another meeting accessible to the shared Zoom account.

**How to apply:** Preserve a non-user-writable provenance marker whenever creating a meeting through the connector. Gate remote synchronization and deletion on that marker, while allowing legacy session records to be cleaned up locally or recreated through the supported flow.