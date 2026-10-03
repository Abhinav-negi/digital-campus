# Digital Campus: Design

> A complete breakdown of the prototype's design (`../digital-campus-mvp/style.css` + the `<style>` blocks in each page), written so it can be recreated exactly.
> **Rule for builders:** port `style.css` verbatim into `web/src/styles/style.css`, and reuse its class names. Don't invent new visual language. If a screen needs something new, build it from the tokens below.

---

## 1. Philosophy
The design came out of the five-person council (`../concil.md`). Each voice left a rule:

| Voice | Rule in the interface |
|---|---|
| **Jobs**: one clear point of view | Each screen answers one question: *what's next? where do I stand? who can I build with?* The hero card shows **one** thing (the next class). |
| **Rams**: less, but better | No decoration standing in for function. Flat white cards, thin hairlines, one shadow. Colour carries meaning (status, kind), never ornament. |
| **Zuckerberg**: reasons to return | Today is a dashboard that is already filled in. The Commons card rotates one relevant thing. Counts ("41 of 58 seen") invite one tap. |
| **Chesky**: hosted, not operated | A warm font, friendly illustrated avatars, kind empty states ("You're all caught up."), greetings by time of day, and copy that never blames. |
| **Maeda**: defaults do the work | Everyone is present by default. A post goes to this class by default. Availability is one coloured word. Forms have five fields or fewer. |

**Principles**
1. **Faster than today.** Every action must beat the paper or WhatsApp habit it replaces.
2. **Honest.** Edits are logged and visible. Numbers come from the source (teacher attendance), never guesses.
3. **Calm.** Neutral surfaces and one accent per personality. Red appears only when something needs action.
4. **Phone-first, laptop-equal.** A bottom nav on phones and a left rail on laptops, with the same content.

---

## 2. Two personalities, one system
One stylesheet; the body class switches the palette (`<body class="student">` / `<body class="teacher">`). **Admin uses the teacher palette.** The landing page uses neutral `:root`.

| Token | Neutral (`:root`) | **Student**: young, warm, energetic | **Teacher / Admin**: calm, trustworthy, institutional |
|---|---|---|---|
| `--primary` | `#18181B` | `#4F46E5` indigo | `#172554` deep navy |
| `--secondary` | `#4F46E5` | `#7C3AED` violet | `#0F766E` teal |
| `--accent` | `#F97316` | `#F97316` orange | `#D97706` amber |
| `--bg` | `#FFFFFF` | `#F7F7FF` lavender-white | `#F8FAFC` slate-white |
| `--surface` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `--text` | `#18181B` | `#18181B` | `#0F172A` |
| `--muted` | `#71717A` | `#71717A` | `#64748B` |
| `--success` | `#10B981` | `#10B981` | `#15803D` |
| `--tint` | — | `#EEF0FF` | `#EEF2F7` |

**Shared semantic colours:** `--danger #DC2626` / `--danger-bg #FEF2F2`, `--warn #B45309` / `--warn-bg #FFFBEB`, `--line rgba(15,23,42,.08)`.
**Derived tints** use `color-mix(in srgb, <colour> 12–16%, transparent)` for badges, chips and kind icons, so new colours stay consistent.

**Commons post kinds** (each sets `--k` on the card; PROTO student.html:44-46):
| Kind | `--k` | Icon |
|---|---|---|
| Ask | `var(--primary)` | chat |
| Gig | `#B45309` | code |
| Market | `#0F766E` | star |
| Lost | `#BE185D` | search |
| Found | `#15803D` | check |

**Availability badges:** Open = `--success`, Questions only = `--secondary`, Focus = muted grey.
**Attendance bars:** safe = `--success`, warn (within 3% of the minimum) = accent, below = `--danger`.

---

## 3. Foundations
**Type.** **Josefin Sans** (300–700; geometric and friendly, with a slightly retro school-sign feel), falling back to `system-ui`. Self-host via `@fontsource/josefin-sans` for the PWA. Base **17px / 1.5**, antialiased.
| Style | Size / weight |
|---|---|
| h1 | 40px / 700, line-height 1.1, letter-spacing -.01em (32px ≤720px) |
| h2 | 28px / 700 (24px ≤720px) |
| h3 | 20px / 600 |
| h4 | 17px / 600 |
| `.small` | 15px · `.tiny` 13px +.02em · `.eyebrow` 13px / 600 / +.12em UPPERCASE muted |
| stat number | 32px / 700, line-height 1 |

**Spacing: an 8-point grid.** `--s0 4` `--s1 8` `--s2 16` `--s3 24` `--s4 32` `--s5 40` `--s6 48` `--s8 64` `--s10 80` (px). Never use raw pixel gaps; compose from tokens (e.g. `calc(var(--s10) + var(--s4))`).
**Radius.** `--r1 8` (inputs, small items) · `--r2 16` (cards) · `--r3 24` (sheets) · `--pill 999` (buttons, chips, tabs).
**Elevation.** One shadow: `0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.05)`. Cards are flat with a 1px `--line` border by default; `.lift` adds the shadow; `.click` lifts 2px on hover.
**Focus.** `:focus-visible` → 2px `--primary` outline, 2px offset. Inputs on focus: primary border + 3px 15% primary ring.

---

## 4. Layout
- **App shell** (`.app`): a grid of **240px rail + main**. The rail is sticky, full height, white, with a right hairline; it holds the brand at the top, nav items, and footer links at the bottom (`margin-top:auto`).
- **Main**: padding 48/48/80, max-width 1120px. `.page-head` = title block left + primary action right, aligned to the bottom, wrapping.
- **≤860px**: the rail is hidden → a **fixed bottom nav** (icons over 12px labels, safe-area padding). Main padding becomes 24/16/112. Grids collapse to one column. A **FAB** "+ Post" / "+ New post" floats above the bottom nav.
- **Brand mark**: a 24px rounded square in `--primary` with an 8px `--accent` dot at its top-right corner, plus "Digital Campus" in 18px/700.
- Helpers: `.stack` (column gap 16), `.stack-lg` (32), `.row` (centre, gap 16), `.between`, `.wrap`, `.grow`, `.grid-2/3` (gap 24), `.section` (margin-top 48).

---

## 5. Components (class names to reuse)
| Component | Spec |
|---|---|
| `.card` | white, 1px line, r2, padding 24. Variants: `.lift`, `.click` (hover −2px + shadow), `.tint` (tint bg, no border), `.hero` (primary bg, white text, muted at 70% white). |
| `.list` | children separated by hairlines, padding 16 vertical. |
| `.btn` | pill, min-height **44px**, padding 0 24, 600/16px, hairline border, white. `:hover` tint, `:active` scale .98. Variants: `.primary` (filled primary, brightness 1.1 on hover), `.accent`, `.ghost`, `.sm` (36px/15px), `.block`; `[disabled]` 45% opacity. |
| `.icon-btn` | a 40px circle with a hairline. |
| `.chip` | pill, tint bg, 14px/500, padding 4/12. `.on` = primary filled. Used as filter chips (button) and meta tags. Extras: `.due` (accent 16%, `#C2410C`), `.vio` (secondary 12%). |
| `.badge` | pill, 13px/600, with an **8px dot `::before` in currentColor**. Variants `.open .questions .focus .danger .warn`; `.plain` hides the dot. |
| `.avatar` | a 40px circle (`.sm` 32 · `.lg` 72 · `.xl` 112), tint bg, initials fallback. Images are **DiceBear "notionists"** (hand-drawn, Notion-like) seeded by name with pastel backgrounds `eef0ff, fde7d9, e6f7f1, f3e8ff`. `.avatars` overlap at −8px with a 2px white ring. |
| `.field` / `.input` | label 15px/600 over the input. Inputs are min-height 48px, r1, padding 12/16, 16px text (no iOS zoom). Textareas min-height 112px. |
| `.tabs` / `.tab` | a **segmented control**: tint pill track with 4px padding; the active tab is a white pill with a tiny shadow; horizontally scrollable. |
| `.bar` | an 8px pill track in tint, filled `<i>` in success / `.warn` accent / `.danger`. |
| `.stat` | `.num` 32/700 + `.lbl` muted 15px. |
| `.sheet-bg` / `.sheet` | **modal on desktop** (centred, r3, padding 32, max 560px, 90vh scroll) and a **bottom sheet on phones** (≤720px: pinned bottom, top corners rounded). Backdrop `rgba(15,23,42,.35)`; it closes on backdrop click and on Esc. The header row is the title + an `x` icon-btn. |
| `.toast` | a dark pill, bottom-centre, slides up 24px; 2.6s; sits above the bottom nav on mobile. Copy is short and past tense ("Attendance saved · students updated"). |
| `.empty` | centred, muted, padded, with a **120px notionists illustration** seeded by context (`calm`, `board`, `search`, `Sunny`…) above one kind sentence. |
| Kind card | `.kico` 32px circle (kind 14% bg + kind colour icon), `.kl` kind label in the kind colour, title, 2-line `.clamp` body, meta chips, author byline with branch/year. |
| Branch label `.pl` | 13px muted "CSE · 2nd year". Another branch → `.xb`: secondary on a 10% secondary pill ("Other branch"). |
| Switch `.sw` | a 48×24 pill toggle, primary when on (PROTO student.html:55-57). |
| Roster `.tile` | attendance grid tile: avatar, roll number (last 3 digits), first name, state. `.absent` = danger-bg, red text, greyscale avatar. "Same device" warn badge (PROTO teacher.html:34-46). |
| Code ring | a 160px SVG ring counting down 20s around a 44px 4-digit code (PROTO teacher.html:48-51). |
| Save bar | a sticky bottom card with the counts on the left and the primary Save on the right. |

---

## 6. Iconography
Inline SVG, a **24px grid, `stroke-width 1.8`, round caps and joins, `fill:none`, `currentColor`**, usually rendered at 20px (16 inside small buttons). The set (PROTO data.js:339-364): home, class, people, spark, user, calendar, check, plus, bell, send, search, x, github, code, link, file, clock, edit, shield, flag, star, chat, logout. Port these as one `<Icon name>` component and add new icons in the same style.

---

## 7. Motion
Subtle and functional only. View switch: `fadein .2s`. Sheet: backdrop `fadein .15s` + panel `rise .2s ease` (16px up). Card hover lift `.15s`. Button press `scale(.98)`. Toast `.2s`. Landing avatars float 8px over 4s. **`prefers-reduced-motion` turns decorative motion off.**

---

## 8. Voice and copy
- Short and second-person: "Good morning, Riya", "You're all caught up.", "Nothing due in the next two weeks."
- **Numbers that mean something**: "Maths 82% · Safe by 3 classes", "Physics 71% · Attend the next 4", "41 of 58 seen".
- Sentence case everywhere. Branch and year on every name. Dates as "Mon, 12 Oct" with relative words ("tomorrow", "in 3 days").
- Rules are stated plainly where they apply (the Gig honesty note on the form, the Market safety tip on the sheet).
- New in v1: empty states for CR-owned content say who will fill them: "Your CR will add the timetable soon."

---

## 9. Accessibility
Tap targets ≥44px. 16px inputs. A visible focus ring. `aria-pressed` on toggles (roster tiles, stars). `aria-label` on icon buttons. Sheets get `role="dialog" aria-modal`. Colour is never the only signal (badges carry words). Keyboard: Esc closes sheets, and everything is reachable with Tab.

---

## 10. Inspirations
| From | What we took |
|---|---|
| iOS / Apple HIG | Bottom sheets on phones, the segmented control, large tap targets, Focus mode with auto-revert |
| Notion | The calm white canvas, hairline borders, and hand-drawn "notionists" avatars as warmth |
| Material / Android | The bottom navigation + FAB pattern |
| Linear / Stripe dashboards | The 8-pt rhythm, one restrained shadow, stat blocks |
| Google Classroom / Teams | The class as a space; teacher post cards with due chips |
| WhatsApp Communities | Broadcast-first posts; read receipts → "seen" counts |
| LinkedIn "Open to work", Slack status | Availability as one coloured word |
| Messaging-app attachment sheets | The "What do you need?" composer with five big tiles |
| Indian "bunk manager" apps | The "Safe by N / Attend the next N" attendance language |
| GitHub | "Good first issue" style roles needed; contribution logs |

---

## 11. Recreate checklist
1. Josefin Sans, 17px base, the 8-pt tokens, the three palettes as body classes.
2. Rail + main on desktop, bottom nav + FAB at ≤860px.
3. Cards flat with hairlines; one shadow; pill buttons, chips and tabs.
4. Notionists avatars everywhere a person appears, with branch/year beside their name.
5. Sheets for every detail and form (bottom sheets on phones), and a toast for every action.
6. Kind colours for the Commons; status colours for attendance and availability.
7. Illustrated empty states with one kind sentence.
