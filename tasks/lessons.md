# ECS Connect v2 - Lessons Learned

## Architecture Decisions

_Record decisions made and why, so future sessions understand the rationale._

## Gotchas

- **No dotenv in project**: Replit injects env vars automatically. Locally, use `--env-file=.env` (Node 20.6+) in the dev script.
- **macOS port 5000 taken**: AirPlay Receiver uses port 5000 on macOS. Use `PORT=3000` in `.env`.
- **`reusePort: true` crashes on macOS**: This is a Linux/Replit-specific socket option. Removed from `server.listen()`.
- **WebSocket conflict with Vite HMR**: The `ws` library's `WebSocketServer({ server })` steals upgrade events from Vite. Fix: use `noServer: true` and manually handle upgrades for `/ws/notifications` only.
- **Neon DB password**: Copy `DATABASE_URL` from Replit Secrets or Neon dashboard. Passwords don't auto-rotate.

## GoCanvas API Structure

- **Flat format** (`?format=flat`): Returns a flat array of entries with `type` (human-readable name like "Text", "Single Choice"), `entry_type_id` (numeric type), `reference_data_id`, and `required`. No section/sheet grouping.
- **Nested format** (`?format=nested`): Returns `sections → sheets → entries` hierarchy. Entries have `entry_values` (inline dropdown options), `conditions` (visibility rules), and `operations` (calculations). Does NOT include the human-readable type name — only `entry_type_id`.
- **Conditions and operations are per-entry** (and per-sheet), NOT at the form top-level. Must iterate entries to collect them.
- **Reference data tables**: Fetched separately via `GET /reference_data/{id}`. Some are huge (Customer List = 11,594 rows, Parts Cross-Reference = 3,471 rows).
- **To get full picture**: Must fetch both flat + nested, merge flat type metadata into nested entries, then fetch all referenced ref data tables. The `dumpGoCanvasForm.js` script does this automatically.

## Patterns That Work

_Record patterns that proved effective for this codebase._
