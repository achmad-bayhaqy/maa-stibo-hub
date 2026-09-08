# Redeploy STIBO Hub

Two supported paths (no credentials are stored in this repo):

## 1. SSH-based (default, no AWS credentials needed)
    bash scripts/redeploy_ssh.sh [reset]

Archives `main` via `git archive`, uploads with SFTP, extracts on the instance,
`docker compose up -d --build`. `reset` also wipes the DB volume (fresh seed).

## 2. S3 presign flow (requires your own AWS credentials in the shell env)
    git archive main -o /tmp/stibo-hub-release.tar.gz
    aws s3 cp /tmp/stibo-hub-release.tar.gz s3://stibo-hub-artifacts-010526264107/releases/stibo-hub-main.tar.gz
    PRESIGN=$(aws s3 presign s3://stibo-hub-artifacts-010526264107/releases/stibo-hub-main.tar.gz --expires-in 3600)
    # then on the instance: curl -sSL "$PRESIGN" -o release.tar.gz && docker compose up -d --build

> Security note: never commit AWS session tokens or PATs. Temporary STS credentials
> expire quickly; inject them per-shell (`export AWS_*`), never in scripts.
