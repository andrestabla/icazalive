---
name: Preview port alignment
description: Replit webview workflow readiness depends on matching the workflow and project port mapping.
---

For a webview preview, the workflow listener and the project port mapping must both use port 5000.

**Why:** A mismatch can make the workflow report a port timeout even when the framework log says the server is ready and bound to `0.0.0.0`.

**How to apply:** When configuring or repairing the preview workflow, set the server to bind `0.0.0.0:5000`, configure the workflow to wait for 5000, and keep the `.replit` port mapping aligned.