# ST-12 · "Set up your class" sheet: once per session
**Reads:** docs/DEMO.md "Failures (re-run)"

## Do
- (Closed, no change.) The reported "reopens every visit" was a test artifact.

## Done when
- [x] Dismiss persists: ClassPage already stores `dc.cr-tip` in localStorage on close; QA-02b used a fresh browser context per visit, so storage was empty each time.

## Notes
- S12: an agent's sessionStorage + floating "Setup tips" button was reverted — it stopped dismiss from persisting. No code change needed.
