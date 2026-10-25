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
echo "Done: $OUT_DIR"
