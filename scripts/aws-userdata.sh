#!/bin/bash
set -euxo pipefail
exec > /var/log/stibo-hub-setup.log 2>&1
# mirror everything to the EC2 console so progress is visible via get-console-output
( tail -F /var/log/stibo-hub-setup.log >/dev/console 2>&1 & )

echo "=== STIBO Hub EC2 setup $(date -u +%FT%TZ) ==="

# 2GB swap for docker build safety
fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

# docker + compose plugin
dnf install -y docker git
systemctl enable --now docker
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# fetch release (no credentials on the instance — presigned URL)
mkdir -p /opt/stibo-hub && cd /opt/stibo-hub
curl -sSL "__PRESIGN_URL__" -o release.tar.gz
mkdir -p repo && tar -xzf release.tar.gz -C repo && cd repo

# secrets generated ON the instance, never committed
DB_PASSWORD="$(openssl rand -hex 16)"
AUTH_SECRET="$(openssl rand -hex 32)"
printf 'DB_PASSWORD=%s\nAUTH_SECRET=%s\n' "$DB_PASSWORD" "$AUTH_SECRET" > .env
chmod 600 .env

docker compose -f docker-compose.aws.yml up -d --build
touch /opt/stibo-hub/.deploy-done
echo "=== STIBO Hub deploy finished $(date -u +%FT%TZ) ==="
# stream container logs to the console for post-mortem visibility
nohup sh -c 'cd /opt/stibo-hub/repo && docker compose -f docker-compose.aws.yml logs -f --tail=60 >/dev/console 2>&1' &
echo "=== console log streamer started ==="
