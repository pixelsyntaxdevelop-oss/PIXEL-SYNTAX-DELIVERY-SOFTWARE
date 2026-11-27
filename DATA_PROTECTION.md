# Protected data and separate environments

- Allied Delivery Software (allieddelivery.ae) and Pixel Syntax Delivery Software (deliverysoftwarepixel.site) are independent environments. Do not mix, copy, synchronize or seed their tenant data into each other.
- Existing employees, user accounts, names, SIMs, bikes, documents, forms, assignments, payroll, and associated records are protected. No edits, renames, deletions, archival, resets, test seeding or bulk changes without the owner's explicit permission for the exact operation and environment.
- Do not run destructive cleanup or delete operations during maintenance. Preserve original files and history. Normal authorized user-initiated business operations are separate from maintenance.
- Port compatible code improvements only. Use additive, non-destructive schema migrations where necessary; no backfills or real-record mutations without explicit permission.
- Test in an isolated mock or disposable environment. Verify tenant scope and storage binding before changes. Never use real company records for destructive or mutating tests.
- Prefer adding new documents and invoice records rather than replacing previous records. Preserve invoice numbers, original files and reference history. Title and expiry are optional for general documents.
- Build and regression checks must pass before deployment.
