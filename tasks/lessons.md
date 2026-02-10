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

- **`!!prefill.x && (<JSX>)` for unknown conditionals**: When `prefill` is `Record<string, unknown>`, you must coerce to boolean with `!!` before using `&&` in JSX. Otherwise TS sees `unknown | ReactElement` which isn't valid `ReactNode`. Use `String(prefill.x)` (not `as string`) for rendering text from unknown values.
- **`Array.from(new Set(...))` instead of `[...new Set(...)]`**: The spread operator on Set requires `--downlevelIteration` compiler flag. `Array.from()` works without it.
- **Section sub-component pattern for large forms**: The emissions form has 12 sections per part. Each section is a separate component file in `components/forms/emissions/`. The parts-loop-section.tsx acts as orchestrator, conditionally rendering sections based on centralized visibility rules in `emissions-form-config.ts`. This keeps each file manageable (~100-300 lines) vs one 3000-line monolith.
- **`useWatch` for scoped re-renders**: Within section components, `useWatch({ control, name: ... })` only re-renders the section that watches that field, not the entire form. Critical for a 60+ field form.
- **Hardcoded reference data for offline**: All dropdown options extracted from GoCanvas are in `emissions-reference-data.ts` as `const` arrays. This ensures the form works offline without API calls for reference data.
- **FormLabel `required` prop**: Extended the Shadcn FormLabel to accept `required?: boolean`, rendering `<span className="text-destructive ml-1">*</span>`. Backward compatible — existing labels without `required` render unchanged. Uses the existing `children` pattern to append the asterisk after label text.
- **Schema/component field name mismatches (FIXED)**: The Zod `partResponseSchema` had 33 fields with names that didn't match what the section components registered. Fixed by creating `emissions-form-fields.ts` as a single source of truth config — the schema, defaults, and test data generator now derive from it. The `repairDescription` field collision between one-box-diagnostics and repair-assessment was also fixed (renamed to `repairDescriptionOneBox` in the one-box section).
- **Config-driven form architecture**: `emissions-form-fields.ts` defines all ~85 fields with canonical names, types, section membership, visibility rules, and test-data hints. `buildPartSchema()` generates Zod schema, `getPartDefaults()` generates form defaults, and the test data generator iterates the config. When adding a new field, you only update the config — all three consumers stay in sync automatically.
