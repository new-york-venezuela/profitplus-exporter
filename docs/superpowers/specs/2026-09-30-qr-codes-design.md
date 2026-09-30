# QR Code Generator & Library — Design

## Goal

A new page `/qr` ("Códigos QR"), next to "Firma Corporativa" in the sidebar, where any
authenticated user can generate a QR code with a centered logo, download it, and keep a
saved per-user library of the QR codes they created.

## Requirements

- Input: a name (label) and content (URL or free text).
- Logo in the center: defaults to the brand favicon; user may upload their own or choose none.
- Download as PNG and SVG.
- Saved library, per user: list, load into editor, re-download, edit, delete.
- The QR encodes the content directly (no redirect, no scan tracking). A saved QR works
  independently of this app.
- Access: all authenticated users (same as `/firmas`); no module gate.

Out of scope: scan counting, dynamic/redirect QRs, styling beyond foreground color.

## Approach

Client-side rendering, server stores the record. The browser renders the QR matrix with the
`qrcode` package and composites the logo on a canvas; PNG and SVG exports come from the same
matrix. The server stores only metadata and uploaded logo files. This matches `/firmas`
(client-only) and gives instant live preview without a server image pipeline.

Rejected: server-side rendering with `sharp` (round-trip per edit, more code, no user gain);
storing rendered PNGs (cannot re-style or edit, bloats storage).

## Data

New SQLite table `qr_codes` (`lib/db/schema.ts`, Drizzle migration in `migrations/sqlite/`):

| Column      | Type                                   | Notes                          |
|-------------|----------------------------------------|--------------------------------|
| id          | integer PK autoincrement               |                                |
| userId      | integer, FK users.id, cascade delete   |                                |
| name        | text, not null                         |                                |
| content     | text, not null                         |                                |
| logoMode    | text enum `default`/`custom`/`none`    |                                |
| logoPath    | text, nullable                         | set only when `custom`         |
| fgColor     | text, not null, default `#000000`      | hex                            |
| createdAt   | integer, unix ms                       |                                |
| updatedAt   | integer, unix ms                       |                                |

Custom logos are stored as files under `data/qr-logos/` (next to the SQLite file); the DB
holds only the path. Limits: 1 MB, PNG/JPG/SVG only.

## API

Every route calls `getSessionFromRequest(request)` itself (no middleware) and scopes all
queries to `session.sub`. Another user's record returns 404. Errors use `{ error: string }`.

- `GET /api/qr` — list own QR codes
- `POST /api/qr` — create (multipart: fields + optional logo file)
- `PATCH /api/qr/[id]` — update fields and/or logo
- `DELETE /api/qr/[id]` — delete record and its logo file
- `GET /api/qr/[id]/logo` — stream own custom logo

Validation: name and content non-empty (content length capped), `fgColor` matches hex, logo
MIME/size checked server-side, stored filename generated server-side (never from user input).
`captureEvent` on create and delete; `captureException` in catch blocks.

## Rendering

- Error correction level H so a logo covering ~20% of the area still scans.
- Logo drawn on a white rounded backing square in the center.
- Default logo: copy of `../web/public/favicon.svg` placed at `public/qr-default-logo.svg`
  (`../web` is not part of this app's deploy). One-time copy; does not stay in sync.
- SVG export embeds the logo as an `<image>` element.

## UI

- `components/sidebar.tsx`: add `{ href: '/qr', label: 'Códigos QR' }` after Firma Corporativa.
- `app/(app)/qr/page.tsx`, Spanish copy:
  - Left: form (name, content, logo choice default/upload/none, color), live preview,
    PNG and SVG download, Save/Update.
  - Right: "Mis códigos QR" list — thumbnail, name, actions (load into editor, download, delete).

## Testing

- Unit: API ownership (other user's id → 404), validation (oversized/wrong-type logo, bad
  color, empty fields), delete removes the logo file.
- Unit: rendered QR matrix decodes back to the original content.
- E2E (existing Playwright suite): create → appears in list → delete smoke test.
