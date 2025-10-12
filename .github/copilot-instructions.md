# Dokploy Open Source Templates - Copilot Instructions

## Project Overview

This repository maintains Docker Compose templates for deploying 200+ open-source applications via Dokploy, a self-hosted PaaS alternative to Heroku. The core structure revolves around the `blueprints/` directory, where each subdirectory represents a deployable service (e.g., `blueprints/ghost/` for Ghost blogging platform).

Key components:

- **Blueprints**: Self-contained templates with `docker-compose.yml` (service definitions) and `template.toml` (Dokploy-specific configuration for domains, env vars, mounts).
- **meta.json**: Centralized index of all templates, aggregated from blueprint metadata. Entries include `id`, `name`, `version`, `description`, `logo`, `links`, and `tags`.
- **app/**: Vite + React + TypeScript frontend for local preview/development (runs at http://localhost:5173). Uses Fuse.js for fuzzy search, Zustand for state management, and shadcn/ui components. Copies blueprints and meta.json to dist during build via `vite-plugin-static-copy`.
- **Scripts**: Node.js tools in root and `build-scripts/` for maintaining `meta.json` (deduplication, sorting, validation).

Data flow: New templates added to `blueprints/` → Metadata updated in `meta.json` → Processing scripts ensure consistency → App builds include static blueprints/meta for preview → Fuse.js indexes templates for fuzzy search.

The "why": Enables rapid, standardized deployment of 200+ OSS apps on Dokploy without manual config. Structure prioritizes simplicity—each blueprint is independent, no shared state or complex interdependencies.

## Key Files and Directories

- `meta.json`: Array of template objects. Always process after edits using `node dedupe-and-sort-meta.js` to remove duplicates (by `id`) and sort alphabetically.
- `blueprints/<service>/`:
  - `docker-compose.yml`: Standard Docker Compose v3.8. Avoid `ports`, `container_name`, `networks`—Dokploy handles isolation via internal networks.
  - `template.toml`: Defines variables (e.g., `${domain}`), domains (service:port → host), env vars, and mounts. Use helpers like `${password:32}`, `${uuid}`, `${jwt:secret_var}`.
  - `logo.svg/png`: Service icon, referenced in `meta.json`.
- `app/vite.config.ts`: Configures build to copy `blueprints/*` and `meta.json` to dist root for static serving.
- `dedupe-and-sort-meta.js`: Standalone script—reads `meta.json`, removes duplicate `id`s (keeps first), sorts by `id` (case-insensitive), creates timestamped backup.
- `build-scripts/process-meta.js`: Advanced processor with CLI options (`--verbose`, `--no-backup`, `--input`/`--output`), JSON schema validation (required: `id`, `name`, `version`, `description`, `links.github`, `logo`, `tags` array).

Exemplary blueprint: `blueprints/ghost/`—`docker-compose.yml` exposes port 2368; `template.toml` maps domain to Ghost service; meta entry tags as ["blogging", "cms"].

## Development Workflow

1. **Add/Update Template**:

   - Create `blueprints/<id>/` (e.g., `ghost`) with lowercase kebab-case ID.
   - Implement `docker-compose.yml` (single service typical; use volumes for persistence).
   - Configure `template.toml`—reference vars in `[config.domains]`, `[config.env]`, `[config.mounts]`.
   - Add logo file (SVG preferred, ~128x128px) to blueprint folder.
   - Add/update `meta.json` entry with exact `id` matching folder name.
   - **CRITICAL**: Run `node dedupe-and-sort-meta.js` or `npm run process-meta` after editing `meta.json`.
   - Commit; PR triggers Dokploy preview (base64 import for testing).

2. **Local Development**:

   - **Frontend**: `cd app && pnpm install && pnpm dev` (Vite dev server at http://localhost:5173).
   - **Meta processing**: `npm run process-meta` or `make process-meta` (Makefile targets: `validate`, `check`, `build`).
   - **Build app**: `cd app && pnpm build`—TypeScript compilation + Vite build, copies blueprints/meta to `dist/` for static hosting.
   - **Test template**: Use PR preview URL or local Dokploy instance; import base64 from template card.
   - **Quick validation**: `make check` shows duplicate count and sort status without modifying files.

3. **CI/CD**:
   - `.github/workflows/validate-meta.yml`: Runs on push/PR to `meta.json`—validates structure, checks duplicates/sort order, compares processed vs original.
   - `.github/workflows/build-preview.yml` & `deploy-preview.yml`: Auto-deploy PR previews to Cloudflare Pages.
   - Processing in CI: Use `--no-backup` flag to avoid backup files in CI environments.

No formal tests—validation via scripts and manual Dokploy deploys. Debug: Check console output from processing scripts for warnings (e.g., missing `id`, invalid schema).

## Conventions and Patterns

- **Template IDs**: Lowercase, kebab-case (e.g., `activepieces`, `ghost`); unique across repo—enforced by dedupe script.
- **Docker Compose**:

  - Version: `3.8` required.
  - **NEVER** include: `ports` (expose only), `container_name`, `networks` (Dokploy handles via isolated deployments).
  - **ALWAYS** include: `restart: unless-stopped` or `restart: always`, persistent volumes (e.g., `- db-data:/var/lib/postgresql/data`).
  - Service names: Match blueprint folder name (e.g., `ghost` service in `blueprints/ghost/`).
  - Example from `blueprints/ghost/docker-compose.yml`:
    ```yaml
    version: "3.8"
    services:
      ghost:
        image: ghost:6-alpine
        restart: always
        volumes:
          - ghost:/var/lib/ghost/content
    volumes:
      ghost:
    ```

- **template.toml**:

  - Variables: `[variables] main_domain = "${domain}"`; use helpers for secrets (`${password:64}`, `${base64:32}`, `${uuid}`).
  - Domains: `[[config.domains]] serviceName = "ghost" port = 2368 host = "${main_domain}"` (path="/" optional).
  - Env: `env = ["KEY=VALUE", "DB_PASSWORD=${db_pass}"]` array of strings, interpolating vars.
  - Mounts: `[[config.mounts]] filePath = "/etc/config" content = """multi-line\ncontent"""`.
  - **Helpers available**: `${domain}`, `${password:length}`, `${base64:length}`, `${hash:length}`, `${uuid}`, `${randomPort}`, `${email}`, `${username}`, `${timestamp}`, `${timestamps:datetime}`, `${timestampms:datetime}`, `${jwt:secret_var:payload_var}`.
  - JWT helper: `${jwt:mysecret:mypayload}` for auth tokens; payload as JSON string with `exp: ${timestamps:2030-01-01T00:00:00Z}`.

- **meta.json**:

  - Required fields: `id`, `name`, `version`, `description`, `links` (with `github`), `logo`, `tags` (array).
  - Tags: Lowercase strings (e.g., `["monitoring", "database"]`).
  - Version: Must match Docker image version in `docker-compose.yml`.
  - Logos: SVG preferred; size ~128x128; filename in `logo` field (e.g., `"ghost.jpeg"`).

- **Frontend (app/)**:
  - State: Zustand store in `app/src/store/index.ts` manages templates, search query, selected tags, view mode.
  - Search: Fuse.js fuzzy search in `app/src/hooks/useFuseSearch.ts` searches across `name`, `description`, `tags`, `id`.
  - Components: shadcn/ui components in `app/src/components/ui/`, custom components in `app/src/components/`.
  - Routing: React Router with URL params for search query (`?q=search`).
  - Build: `vite-plugin-static-copy` copies `blueprints/*` and `meta.json` to dist root.

Cross-component: No runtime communication—templates independent. App consumes static blueprints/meta for UI rendering (search, cards, dialogs).

## Integration Points

- **Dokploy**: Templates import via base64 (full compose + config) or URL. Test deploys validate env interpolation, domain proxying.
- **External Deps**: Docker Compose (v3.8+); TOML parsing via `@iarna/toml` in app. No runtime deps beyond Node/pnpm for dev.
- **PR Previews**: Auto-generated on GitHub—use for end-to-end testing without local Dokploy.

When editing, always re-run meta processing and validate blueprint deploy in preview.

## Common Pitfalls & Solutions

1. **Forgot to process meta.json**: Always run `node dedupe-and-sort-meta.js` after editing. CI will fail if duplicates exist or file isn't sorted.
2. **Template not appearing in app**: Check `meta.json` has matching `id` to blueprint folder name. Rebuild app with `cd app && pnpm build`.
3. **Docker Compose errors in Dokploy**: Remove `ports`, `container_name`, `networks` from compose file. Use `expose` instead of `ports`.
4. **Environment variables not interpolating**: Ensure `template.toml` uses correct syntax: `env = ["KEY=${variable}"]` (array of strings, not object).
5. **Search not finding template**: Fuse.js searches `name`, `description`, `tags`, `id`. Check these fields in `meta.json` contain relevant keywords.
6. **Logo not displaying**: Verify logo file exists in blueprint folder and filename matches `meta.json.logo` field exactly (case-sensitive).

## Quick Reference Commands

```bash
# Process meta.json (ALWAYS run after editing)
node dedupe-and-sort-meta.js
# or
npm run process-meta
# or
make process-meta

# Validate without modifying
make validate
# or
npm run validate-meta

# Quick check for issues
make check

# Frontend development
cd app && pnpm dev

# Build frontend
cd app && pnpm build

# Clean backup files
make clean
```
