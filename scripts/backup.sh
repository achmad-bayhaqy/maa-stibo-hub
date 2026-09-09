#!/bin/sh
# stibo-hub PostgreSQL daily backup — pg_dump -> gzip -> local rotate (7) -> S3
# Runs from root crontab. Uses the EC2 instance role (no static keys).
set -e
BACKUP_DIR=/opt/stibo-hub/backups
BUCKET=stibo-hub-backups-010526264107
TS=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"
docker exec stibo-hub-pg pg_dump -U stibohub stibohub | gzip > "$BACKUP_DIR/stibohub-$TS.sql.gz"

# rotate local copies (keep 7)
ls -1t "$BACKUP_DIR"/stibohub-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

# upload to S3 (30-day lifecycle on the bucket)
aws s3 cp "$BACKUP_DIR/stibohub-$TS.sql.gz" "s3://$BUCKET/postgres/stibohub-$TS.sql.gz" --region us-east-1

echo "$(date -u +%FT%TZ) backup ok: stibohub-$TS.sql.gz ($(du -h "$BACKUP_DIR/stibohub-$TS.sql.gz" | cut -f1))"
