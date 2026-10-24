#!/usr/bin/env bash
# Export every Claude Code session for this project to HTML (plus raw JSONL)
# using simonw/claude-code-transcripts. Re-run any time; output is overwritten.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Claude Code stores sessions under ~/.claude/projects/<path with / and spaces as ->
SESSIONS_DIR="$HOME/.claude/projects/$(echo "$PROJECT_DIR" | sed 's#[/ ]#-#g')"
OUT_DIR="$PROJECT_DIR/transcripts"

mkdir -p "$OUT_DIR"
for f in "$SESSIONS_DIR"/*.jsonl; do
  id="$(basename "$f" .jsonl)"
  echo "Exporting $id"
  uvx claude-code-transcripts json "$f" -o "$OUT_DIR/$id" --json
done
echo "Done: $OUT_DIR"
