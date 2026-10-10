#!/bin/sh
# Opt the throwaway workspace in so the plugin acts on long Bash output (local rules only; no network).
mkdir -p .claude && printf '{"schemaVersion":1,"enabled":true,"mode":"assist","backend":"rules","minimumChars":2000}\n' > .claude/jev-agent-kit.json
