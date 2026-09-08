#!/bin/bash
# Redeploy STIBO Hub via direct SSH+SFTP (no AWS credentials needed).
# Usage: scripts/redeploy_ssh.sh [reset]   — 'reset' wipes the DB volume (re-seed).
set -euo pipefail
cd /home/z/my-project

RESET_FLAG="${1:-}"
git archive main -o /tmp/stibo-hub-release.tar.gz
echo "archive: $(du -h /tmp/stibo-hub-release.tar.gz | cut -f1)"

python3 scripts/deploy_ssh.py "$RESET_FLAG"
echo "=== redeploy triggered ==="