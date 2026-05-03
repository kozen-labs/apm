#!/usr/bin/env bash
# install-mongodb-skills.sh
# Installs the MongoDB Skills Pack into ~/.claude/skills/ for global availability
# in Claude Code CLI and Claude Desktop (both read from ~/.claude/skills/).
#
# Usage:
#   bash scripts/install-mongodb-skills.sh           # install
#   bash scripts/install-mongodb-skills.sh --uninstall  # remove

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_SRC="$PROJECT_ROOT/.agents/skills"
MANIFEST_SRC="$PROJECT_ROOT/.claude/manifest.json"
SKILLS_DST="${HOME}/.claude/skills"
SHARED_SRC="$SKILLS_SRC/shared"
SHARED_DST="$SKILLS_DST/shared"
SKILL_PREFIX="mongodb-"

# ── helpers ──────────────────────────────────────────────────────────────────
info()    { echo "  [info]  $*"; }
success() { echo "  [ok]    $*"; }
warn()    { echo "  [warn]  $*"; }

# ── uninstall ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Removing MongoDB skills from $SKILLS_DST ..."
  for skill_dir in "$SKILLS_DST"/${SKILL_PREFIX}*/; do
    [ -d "$skill_dir" ] || continue
    rm -rf "$skill_dir"
    info "Removed $(basename "$skill_dir")"
  done
  [ -d "$SHARED_DST" ] && rm -rf "$SHARED_DST" && info "Removed shared/"
  echo "Done."
  exit 0
fi

# ── install ───────────────────────────────────────────────────────────────────
echo "Installing MongoDB Skills Pack → $SKILLS_DST"
echo

mkdir -p "$SKILLS_DST"

# 1. Copy shared references (used by all skills)
if [ -d "$SHARED_SRC" ]; then
  mkdir -p "$SHARED_DST"
  cp -r "$SHARED_SRC"/. "$SHARED_DST/"
  success "shared/  (docs-map, global-rules, product-matrix)"
fi

# 2. Copy each mongodb-* skill directory
count=0
for skill_dir in "$SKILLS_SRC"/${SKILL_PREFIX}*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  dst="$SKILLS_DST/$skill_name"

  rm -rf "$dst"
  cp -r "$skill_dir" "$dst"

  # Verify SKILL.md exists
  if [ ! -f "$dst/SKILL.md" ]; then
    warn "$skill_name — SKILL.md not found, skipping"
    rm -rf "$dst"
    continue
  fi

  success "$skill_name"
  count=$((count + 1))
done

# 3. Copy manifest — strip the source-only "../.agents/skills/" prefix from paths
#    so installed paths resolve correctly relative to ~/.claude/skills/
if [ -f "$MANIFEST_SRC" ]; then
  sed 's|"\.\./\.agents/skills/|"|g' "$MANIFEST_SRC" > "$SKILLS_DST/mongodb-skills-manifest.json"
  success "manifest.json"
fi

echo
echo "Installed $count skills to $SKILLS_DST"
echo
echo "Verify installation:"
echo "  ls $SKILLS_DST"
echo
echo "To uninstall:"
echo "  bash scripts/install-mongodb-skills.sh --uninstall"
