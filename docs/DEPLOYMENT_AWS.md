# Deploy STIBO Hub ke AWS (us-east-1)

Semua resource memakai prefix **`stibo-`** dan/atau label/tag `project=stibo`.

## Arsitektur (deployment ini)

```
User ──HTTP/HTTPS──► EC2 (stibo-hub-ec2, SG stibo-hub-sg: 80/443/22)
                       ├── container stibo-hub-web   (Next.js 16 standalone, :3000)
                       └── container stibo-hub-pg    (Postgres 16, internal only)
                             └── volume stibo-hub-pgdata (EBS)
```

Kenapa jalur ini: **Amplify Hosting belum mendukung Next.js 16** (managed SSR resmi: Next 12–15 per Sep 2026), dan ECS Fargate membutuhkan `iam:PassRole` yang tidak selalu tersedia di akun workshop. EC2 + Compose berjalan di Node 22 dengan image Next standalone — identik dengan build lokal. Upgrade path produksi: ECS Fargate + ALB + RDS Postgres Multi-AZ + Secrets Manager (catatan di bawah).

## Langkah deploy

1. **Security group** `stibo-hub-sg` — ingress 22 (SSH), 80, 443.
2. **EC2** `stibo-hub-ec2` — Amazon Linux 2023, t3.micro/t4g.micro (free tier).
3. **Install docker** lalu clone repo & jalankan compose:

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user   # re-login
git clone https://github.com/achmad-bayhaqy/maa-stibo-hub.git && cd maa-stibo-hub
sudo DB_PASSWORD="$(openssl rand -hex 16)" AUTH_SECRET="$(openssl rand -hex 32)" \
  docker compose -f docker-compose.aws.yml up -d --build
```

4. **Health check**: `curl http://localhost/api/health` → `{"status":"ok"}`.
5. **(Opsional) HTTPS**: pasang Caddy/Nginx + domain, atau ALB + ACM certificate.

## Konfigurasi Stibo LIVE

Tambahkan ke file `.env` di server lalu `docker compose up -d` lagi:

```
STIBO_TOKEN_URL=https://<stibo-oauth>/token
STIBO_CLIENT_ID=...
STIBO_CLIENT_SECRET=...
STIBO_INBOUND_URL_ARTICLE_PLANNING=https://.../IIEP_ArticlePlanning/upload-direct
STIBO_INBOUND_URL_EAN_UPDATE=https://.../IIEP_EANUpdate/upload-direct
STIBO_INBOUND_URL_ARTICLE_MAINTENANCE=https://.../IIEP_ArticleMaintenance/upload-direct
```

Selama env ini kosong, portal tetap berjalan di **MOCK mode** (bgId disimulasikan, tidak ada data keluar).

### Opsi produksi (rekomendasi): AWS Secrets Manager

Alih-alih menaruh secret di `.env`, portal mendukung resolusi kredensial langsung
dari AWS Secrets Manager (`src/lib/stibo-config.ts`):

1. Buat secret (us-east-1, tag `stibo` sesuai naming policy):

```bash
aws secretsmanager create-secret \
  --name stibo/map-portal/iiep-credentials \
  --region us-east-1 \
  --tags Key=stibo,Value=true \
  --secret-string '{
    "STIBO_CLIENT_ID": "AP-IIEP",
    "STIBO_CLIENT_SECRET": "<client-secret>",
    "STIBO_GRANT_TYPE": "client_credentials",
    "STIBO_TOKEN_URL": "https://auth-jaea01.mdm.stibosystems.com/auth/realms/mapactive-dev/protocol/openid-connect/token",
    "STIBO_INBOUND_URL_ARTICLE_PLANNING": "https://mapactive-dev.mdm.stibosystems.com/restapiv2/inbound-integration-endpoints/IIEP_ArticlePlanning/upload-direct",
    "STIBO_INBOUND_URL_ARTICLE_MAINTENANCE": "https://mapactive-dev.mdm.stibosystems.com/restapiv2/inbound-integration-endpoints/IIEP_ArticleMaintenance/upload-direct",
    "STIBO_INBOUND_URL_EAN_UPDATE": "https://mapactive-dev.mdm.stibosystems.com/restapiv2/inbound-integration-endpoints/IIEP_EANUpdate/upload-direct"
  }'
```

2. Beri hanya `secretsmanager:GetSecretValue` pada secret ARN tersebut ke task/instance role:
   (`aws:ResourceTag/stibo` condition optional untuk mempersempit).
3. Set satu env di server: `STIBO_SECRET_ID=stibo/map-portal/iiep-credentials`.

Portal membaca env var terlebih dahulu; jika tidak lengkap, ia fallback ke Secrets
Manager (cache 5 menit). Status kredensial tampil ter-mask di halaman Settings —
client secret tidak pernah dikirim ke browser. Rotasi: `aws secretsmanager rotate-secret`
lalu tunggu ≤5 menit (cache) — tanpa redeploy.

## Upgrade path produksi

- **ECS Fargate** task `stibo-hub-web` (2 AZ) + ALB `stibo-hub-alb` + ECR repo `stibo-hub/web`.
- **RDS PostgreSQL** `stibo-hub-pg` (db.t4g.small, Multi-AZ, private subnet, SG hanya dari task SG).
- **Secrets Manager** `stibo/prod/oidc` untuk client secret; IAM role terbatas `secretsmanager:GetSecretValue`.
- **S3** bucket `stibo-hub-uploads-*` + presigned upload + GuardDuty malware scan.
- CI/CD: GitHub Actions → ECR → ECS rolling deploy (role via GitHub OIDC, tanpa static keys).
- Backup: RDS automated snapshot + PITR; WAF di ALB.
