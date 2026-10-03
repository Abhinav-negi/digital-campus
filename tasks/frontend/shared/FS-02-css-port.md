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
- S02 🟨 built, **visual check pending**. Page `<style>` blocks are pasted verbatim inside `:where(body.student|body.teacher|.admin|.landing){…}`; `:where` keeps specificity at zero, so `style.css` still wins where the prototype expects it. `:root{--tap}` and `@keyframes float` were moved out (they can't be nested). Admin uses `body class="teacher admin"`.
- All four page sheets load in `main.tsx` (+~6 KB gzip). Added at the end of `style.css`: `.badge.clash`, `.empty.cr`, `.preview-table`, `.sheet .head` (so teacher/admin sheets get the header row). The prototype has no reduced-motion rule outside landing; that's left as is.
- S03 ✅ visual check: headless Chrome screenshots of `/ui` at 1280 and 390 match the prototype (`student.html`): font, tokens, cards, bars, badges, chips. Only the test page's own body-class switcher clips at 390 (test page only).
