#!/usr/bin/env bash
# Export every Claude Code session for this project to HTML (plus raw JSONL)
# using simonw/claude-code-transcripts. Re-run any time; output is overwritten.
# Includes sessions that ran in worktrees under this folder (the parallel wave 2 tracks),
# which Claude Code stores under their own project directories.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Claude Code stores sessions under ~/.claude/projects/<path with / . and spaces as ->
PREFIX="$HOME/.claude/projects/$(echo "$PROJECT_DIR" | sed 's#[/ .]#-#g')"
OUT_DIR="$PROJECT_DIR/transcripts"
REPO="jay-upadhyay/private-overlap"

mkdir -p "$OUT_DIR"
shopt -s nullglob
for dir in "$PREFIX" "$PREFIX"-*; do
  for f in "$dir"/*.jsonl; do
    id="$(basename "$f" .jsonl)"
    echo "Exporting $id (from $(basename "$dir"))"
    uvx claude-code-transcripts json "$f" -o "$OUT_DIR/$id" --json --repo "$REPO"
  done
done
# Redact personal details before anything is committed: both email addresses and the
# name of the author's other GitHub account.
python3 - "$OUT_DIR" <<'PY'
import os, re, sys
pats = [
    (re.compile(r"jay\.c\.upadhyay(?:@|&#64;|&#x40;|%40|\\u0040)gmail\.com", re.I), "[email]"),
    (re.compile(r"mynridost(?:@|&#64;|&#x40;|%40|\\u0040)gmail\.com", re.I), "[email]"),
    (re.compile(r"mynridost(?:-afk)?", re.I), "[other-account]"),
]
for d, _, files in os.walk(sys.argv[1]):
    for f in files:
        p = os.path.join(d, f)
        try:
            s = open(p, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        n = s
        for rx, rep in pats:
            n = rx.sub(rep, n)
        if n != s:
            open(p, "w", encoding="utf-8").write(n)
PY
echo "Done: $OUT_DIR (redacted)"
