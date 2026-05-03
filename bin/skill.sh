#!/usr/bin/env bash
# skill — shorthand for 'apm --type skill'
# Delegates to bin/apm.sh, inserting --type skill after each subcommand.
#
# Examples
#   bin/skill.sh list
#   bin/skill.sh --provider claude --scope global install
#   bin/skill.sh --provider claude --scope global install ks-devops
#   bin/skill.sh status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Rewrite argv: inject '--type skill' immediately after the subcommand token.
ARGS=()
TYPE_INJECTED=false
for arg in "$@"; do
    ARGS+=("$arg")
    if [[ "$TYPE_INJECTED" == false && "$arg" =~ ^(install|uninstall|list|status|outdated|init)$ ]]; then
        ARGS+=("--type" "skill")
        TYPE_INJECTED=true
    fi
done

# If no subcommand was found, pass args as-is (interactive menu picks up --type via menu).
exec "$SCRIPT_DIR/apm.sh" "${ARGS[@]+"${ARGS[@]}"}"
