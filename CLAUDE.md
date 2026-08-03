# CLAUDE.md

## Git workflow

Commit and push directly to `main`. Do not create a feature branch, and do not
open a pull request, unless I explicitly ask for one.

This applies to Claude Code sessions started from the web too, which are assigned
a `claude/*` branch by default. When that happens, ignore the assigned branch:
check out `main`, commit there, and push with `git push -u origin main`.

If the push is rejected — the git proxy in web sessions can restrict pushes to
the session's assigned branch — fall back to pushing the assigned `claude/*`
branch and say so, rather than leaving the work unpushed.
