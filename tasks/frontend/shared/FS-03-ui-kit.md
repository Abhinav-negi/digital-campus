# FS-03 · UI kit components
**Reads:** DESIGN.md §5–§7 · PROTO `data.js:329-364` (avatar, icons), `student.html:124-144` (sheet + formSheet), `data.js:336-337` (toast)
**Owns:** `web/src/ui/*.tsx` (except AppShell), `web/src/lib/dates.ts`

## Do
- `<Icon name size>` with the exact PROTO path set. `<Avatar user size>` (notionists URL + initials fallback).
- `<Sheet title onClose>` (desktop modal / mobile bottom sheet, Esc and backdrop close, focus trap, `role=dialog`).
- `<FormSheet fields onSubmit>`, a typed port of PROTO `formSheet` (text, textarea, select, date, time, number, checkbox, note, file → presign upload).
- `useToast()` + `<Toaster>`. `<Tabs>` (segmented). `<Badge kind>`, `<Chip on>`, `<Bar pct status>`, `<Stat>`.
- `<Empty seed text action?>` and `<CrWillAdd what>` (the D9 placeholder: "Your CR will add the {what} soon."; the CR sees an "Add {what}" button instead).
- `dates.ts`: `fmt`, `rel` (PROTO `data.js:323-324`), `greeting(hour)`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Every component is used on the FS-02 test page; the sheet works on a 390px viewport.

## Notes
- S02 🟨 built, **visual check pending** (`/ui`, dev only, at 390 px for the sheet). `toast()` is a plain function; FormSheet auto-closes on success and uploads via `/files/presign` (swap to the FS-05 client). Badge holds Chip, Bar holds Stat, Empty holds CrWillAdd.
- `lib/dates.ts`: the greeting switches at 17:00 (the prototype says 18 for students and 17 for teachers). `fmt` matches the prototype ("Mon 12 Oct", no comma, DESIGN §8 differs). `rel` uses the local date. `dates.test.ts` passes.
