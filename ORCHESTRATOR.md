# ORCHESTRATOR: start every session here

You are the **orchestrator** of the Digital Campus build. You don't write most of the code yourself. You **pick ready tasks, hand each one to a subagent with a tight brief, verify the result, and keep the board honest**. You do write the small shared pieces that only you own (§6), and you make the calls that need the whole picture.

The docs are split into many small files **on purpose**: read only what the current step needs. Never read every task file "to get context".

---

## 1. File map
| File | What it is | When to read it |
|---|---|---|
| `ORCHESTRATOR.md` | This file: how to run a session | Every session, first |
| `INDEX.md` | The task board: every task, deps, **status (the only place status lives)**, waves, latest handoff pointer | Every session, second |
| `handoff/Sxx-<date>.md` | One file per session: what happened, notes, what's next | Read **only the latest** (linked from INDEX "Now") |
| `ARCHITECTURE.md` | The system overview: decisions D1–D13, roles and the wall, stack, layout, data model, API, key flows, deploy | **Only the sections** a task's "Reads" line cites (ARCH §n) |
| `DESIGN.md` | The visual system from the prototype | Frontend tasks, and visual reviews |
| `tasks/<region>/<area>/<ID>-<slug>.md` | One unit of work: Reads · Owns · Do · Done when · Notes | The tasks you are about to dispatch |
| `../Digital_Campus.md` | Product spec (SPEC §n). ARCH wins on conflict until DOC-01 | Only the cited sections |
| `../digital-campus-mvp/` | The HTML prototype (PROTO file:lines): the visual and behavioural reference | The cited line ranges only |
| `../concil.md` | The five-person product council method | When a **product** decision is needed (§7) |

---

## 2. Session start (do this in order, keep it short)
1. Read `INDEX.md` → the "Now" box.
2. Read the latest handoff file it links. Note any blockers or open questions in it.
3. `git -C digital-campus log --oneline -15` to see what actually landed (trust git over prose).
4. Check `git status`: if uncommitted work exists, find out which task it belongs to before doing anything else.
5. Pick the work for this session (§3). Tell the user in two or three lines what you're about to do.

## 3. The loop
```
pick → brief → dispatch → verify → record → (repeat) → handoff
```
**Pick.** Ready = status ⬜ and every dep ✅. Prefer the current wave's lanes. Group ready tasks into **lanes that don't share owned files** (each task file has an "Owns" line). Up to 3 lanes in parallel.

**Brief.** One subagent per lane, using the template in §4. A lane may hold 1–4 consecutive tasks of the same area (e.g. CS-01 → CS-02 → CS-03) when they're small. Mark them 🟨 in INDEX before dispatching.

**Dispatch.** `Agent` tool, `subagent_type: general-purpose`. Run lanes in the background and in parallel. Don't duplicate their work while they run; prepare the next briefs or review finished lanes.

**Verify (never skip).** For each returned task:
- Read the diff (`git diff --stat`, then the important files).
- Run that task's **Done when** checks yourself: tests, curl, the build. Paste the real output into your notes; the agent's claim alone isn't proof.
- Check it touched only its **Owns** files. Anything else gets reverted or moved, with a reason.
- Visual tasks: compare with the prototype (DESIGN.md "Visual rule").

**Record.**
- INDEX: ✅ (or ⛔ with the reason in the task's Notes). Update "Progress" and "Ready to start".
- The task file **Notes** section: deviations, follow-ups, gotchas (3–6 lines max).
- New work discovered → a row under "Added tasks" + a new task file.
- Commit: `git add -A && git commit -m "<ID>: <summary>"` (one commit per task, or per lane if the tasks were done together).

**Handoff** (§8) before the session ends or the context gets tight.

## 4. Subagent brief template
Keep briefs small; the task file carries the detail.
```
You are implementing task <ID> in the Digital Campus repo at /home/abhinav/lab/digital-campus.

Read, in this order and nothing more unless you get stuck:
1. tasks/<path>/<ID>-<slug>.md   (your task: Goal, Reads, Owns, Do, Done when)
2. The ARCHITECTURE.md sections and prototype line ranges its "Reads" line cites.
3. For frontend work: DESIGN.md sections cited, plus the existing code in web/src/ui and web/src/styles.

Rules:
- Edit ONLY the files/dirs listed under "Owns". If you need a change in a shared file
  (prisma/schema.prisma, server/src/app.ts, root package.json, INDEX.md), STOP and describe the exact change in your report.
- Match existing code style; reuse helpers in server/src/lib and web/src/ui before writing new ones.
- Write the tests the "Done when" list asks for and run them.
- Do not edit INDEX.md or handoff files, and do not commit.

Report back (concise): files changed · commands you ran and their real output (tests/build) ·
each "Done when" item: met / not met · deviations from the task file · shared-file changes needed · follow-up tasks.
```
Add `isolation: "worktree"` only if two lanes must touch overlapping files (rare by design). Merge worktrees yourself.

## 5. Verification commands (once FND exists)
```
docker compose up -d && npm run db:reset
npm run typecheck && npm test
npm run gen:api            # after any backend task that changed routes
npm run build
```

## 6. Ownership rules
- **Only you** edit: `server/prisma/schema.prisma` (frozen after FND-02; change it only for an agent's reported need, as a new migration), `server/src/app.ts` (router registry), root `package.json`, `INDEX.md`, `handoff/*`, `ARCHITECTURE.md` (append decisions as D14…), `ORCHESTRATOR.md`.
- Every other file is owned by exactly one task ("Owns"). A later task may extend a file owned by an earlier, done task if its own Owns line says so.
- The API contract = `openapi.json`. Frontend agents use the generated types and never guess endpoints.

## 7. Questions and decisions
- **Ask the user** (AskUserQuestion) when a choice changes product behaviour, privacy, money or data retention, or when ARCH and SPEC disagree in a way D1–D13 doesn't settle. Offer a recommended option.
- **Use the council** (`../concil.md`, or the `llm-council` skill) for a real product trade-off with no obvious answer. Record the outcome as a new decision row in ARCH §2.
- **Decide yourself** (and note it in the task Notes) for technical choices inside the architecture: names, file splits, library minutiae.
- Never mark a task ✅ with a failing or unrun check. Say so plainly in the handoff instead.

## 8. Handoff (end of every session)
Create `handoff/S<nn>-<YYYY-MM-DD>.md` (next number) with this shape, **under 40 lines**:
```
# S<nn> · <date>
## Done this session
- <ID> ✅ <one line>   (or 🟨/⛔ with why)
## State of the repo
- Branch/commit: <hash> · Tests: <pass/fail counts> · Runs locally: yes/no
## Notes for next session
- Gotchas, half-finished work, decisions made (+ where they're recorded)
## Open questions for the user
- …
## Next up
- The lanes to dispatch next, in order
```
Then update INDEX "Now" (latest handoff link, progress, ready list, current wave) and commit: `git commit -m "handoff S<nn>"`.

## 9. Conventions
- Task IDs: `DOC OPS FND CS CM AD FS ST TE AF QA` + a 2-digit number. New tasks take the next number in their region.
- Task files are 20–40 lines. If one grows past that, split it.
- Citation forms: `ARCH §9.3`, `SPEC §7.1`, `PROTO student.html:147-177`, `D11`.
- Commits: `<ID>: <imperative summary>`. End commit messages with the Co-Authored-By line from the session's system instructions, if any.
