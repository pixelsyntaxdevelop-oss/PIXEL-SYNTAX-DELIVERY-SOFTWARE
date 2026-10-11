# Pixel Syntax Delivery Software Demo

Standalone Pixel Syntax demo for `deliverysoftwarepixel.site`.

This private repository contains the application source with all Allied operational records, personal user accounts, government ID numbers, SIM and vehicle inventories, payroll workbooks, backups, and saved sessions excluded. New demo data starts empty.

## Deployment values

- Worker: `pixel-syntax-delivery-software`
- Custom domain: `deliverysoftwarepixel.site`
- R2 bucket: `pixel-syntax-delivery-demo-documents`
- Build: `npm install` then `npm run build`

Use a separate Supabase project, Cloudflare Worker, and R2 bucket for this demo. Configure its Supabase URL and server-only keys in the Cloudflare Worker. Apply the schema migrations in `supabase/migrations` to that new project only. Do not connect the Allied production database, Worker, or document bucket.

Connect this private repo in Cloudflare Workers & Pages. After the Worker deploys, add `deliverysoftwarepixel.site` and `www.deliverysoftwarepixel.site` to the new Worker’s custom domains.
