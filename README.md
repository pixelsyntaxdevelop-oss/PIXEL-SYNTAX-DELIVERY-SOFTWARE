# Pixel Syntax Delivery Software — Demo

A standalone delivery operations management software demo by **Pixel Syntax**. This repository is public so prospective clients and developers can review the application structure and features.

> **Demo status:** Source code is available. A working hosted demo, login access, and production readiness have **not** been verified. Please request a walkthrough before relying on a live demonstration.

## Features represented in the codebase

- Rider and employee management
- Fleet and vehicle records
- Attendance and operations dashboards
- Documents and expiry tracking
- Finance and payroll views
- Reports, user access, and administrative tools

Feature availability and behavior depend on deployment configuration. This is a demonstration project, not a promise that every module is production-ready.

## Local development

Requires Node.js and npm.

```bash
npm install
npm run dev
```

To check TypeScript and build the project:

```bash
npm run lint
npm run build
```

Configure required environment variables before using services backed by Supabase, Cloudflare, or object storage. Never commit real credentials, client records, or production data.

## Demo isolation and deployment

The intended demo environment uses a **separate** Supabase project, Cloudflare Worker, and R2 bucket. Do not connect this repository to the Allied production database, Worker, or document bucket.

Planned deployment configuration:

- Worker: `pixel-syntax-delivery-software`
- Domain: `deliverysoftwarepixel.site` (deployment not verified)
- R2 bucket: `pixel-syntax-delivery-demo-documents`
- Build: `npm install && npm run build`
- Frontend environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Server-side secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SESSION_SECRET`

Keep `SUPABASE_SERVICE_ROLE_KEY` and `WORKER_SESSION_SECRET` server-side only. Use a unique session secret and separate demo resources. Review database migrations in `supabase/migrations` before applying them to a new demo project.

## Contributing

Please open an issue describing the problem or improvement, then submit a focused pull request from a feature branch. Each PR should explain the change and how it was tested. Avoid committing secrets or personal information.

## Project notes

The demo is intended to start without real Allied operational records, personal accounts, government IDs, SIM and vehicle inventories, payroll workbooks, backups, or saved sessions. This is a project intention, **not** a completed security audit of every file or Git history.

**Maintained by Pixel Syntax.**
