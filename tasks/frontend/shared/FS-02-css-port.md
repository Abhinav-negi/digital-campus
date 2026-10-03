# FS-02 · Port the design system CSS
**Reads:** DESIGN.md (all) · PROTO `style.css` (whole), the `<style>` blocks in `student.html:8-65`, `teacher.html:8-77`, `admin.html:8-18`, `index.html:8-43`
**Owns:** `web/src/styles/style.css`, `web/src/styles/{student,teacher,admin,landing}.css`

## Goal
Pixel parity starts here. **Verbatim port, no redesign.**

## Do
- Copy `style.css` exactly (drop the Google Fonts `@import`; fonts come from fontsource).
- Move each page's `<style>` block into its area stylesheet, scoped under `body.student` / `body.teacher` / `.admin` / `.landing` where selectors would collide (e.g. `.slot`, `.pick`, `.dots`, `.fab` exist in two pages with different meanings).
- Add only the classes the new features need, built from tokens: `.badge.clash` (danger, plain, "Clash"), `.empty.cr` (the D9 placeholder variant), `.preview-table` (import preview, reusing `.tbl` from the teacher CSS).

## Done when
- [ ] A static test page rendering every component (cards, buttons, chips, badges, tabs, bars, sheet, toast, empty) looks identical to the prototype.

## Notes
