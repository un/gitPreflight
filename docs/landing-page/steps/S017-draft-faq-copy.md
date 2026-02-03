# S017 Draft FAQ Copy

## FAQ

### Do you store my repo code?

Shipstamp avoids storing customer repo source code at rest. The server stores instruction file contents (by hash) when configured (e.g. `AGENTS.md`), plus review outputs and aggregated usage/statistics. It does not store arbitrary repo files.

### What happens if Shipstamp is offline or times out?

The commit is allowed. The commit is marked `UNCHECKED` locally under `.git/shipstamp/`. The next run on the same branch is blocked until the backlog is cleared or explicitly bypassed.

### How do I bypass Shipstamp?

- One-shot bypass: `shipstamp skip-next --reason "<why>"`
- Universal bypass: `git commit --no-verify`

### Is GitHub required?

For now, yes. Shipstamp sign-in uses GitHub.

### What does "reviews up to 5 files" mean on LLM Dabbler?

If a commit changes more than 5 files, Shipstamp reviews the first 5 files only (unique staged paths sorted lexicographically). The commit is still allowed, and the report includes a note listing skipped paths plus an upgrade CTA.
