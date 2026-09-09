#!/usr/bin/env python3
"""Deploy latest `main` to stibo-hub-ec2 via AWS SSM Run Command (no SSH, no
inbound ports). Port 22 stays closed on the security group.

Pipeline:
  1. git archive main -> release tarball
  2. upload tarball + optional env-secret to S3 staging (deploys/ prefix)
  3. SSM send-command on the instance (instance role reads from S3):
       download -> extract to /opt/stibo-hub/repo -> merge .env ->
       docker compose up -d --build -> prune -> health check ->
       UPDATE-only English docs sync into prod DB
  4. poll command invocation, stream output

Usage: python3 scripts/deploy_ssm.py [reset]
  reset — also wipe the docker volume (fresh DB + re-seed)

Fallback (emergencies): scripts/eic_run.py after temporarily opening port 22.
"""
import json
import os
import subprocess
import sys
import time

import boto3

INSTANCE = "i-0952d6a47dc43aa16"
REGION = "us-east-1"
BUCKET = "stibo-hub-backups-010526264107"
STAGE_KEY = "deploys/release.tar.gz"
SECRET_KEY = "deploys/stibo-env.secret"
KEY = "/tmp/stibo-eic"  # unused here; kept for tooling parity
PROJECT = "/home/z/my-project"
RESET = len(sys.argv) > 1 and sys.argv[1] == "reset"

ssm = boto3.client("ssm", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)


def sh(cmd: str, timeout: int = 1800) -> tuple[int, str]:
    """Run a shell command on the instance via SSM; block until done."""
    resp = ssm.send_command(
        InstanceIds=[INSTANCE],
        DocumentName="AWS-RunShellScript",
        TimeoutSeconds=600,
        Parameters={"commands": [f"set -o pipefail; {cmd}"], "executionTimeout": [str(timeout)]},
    )
    cid = resp["Command"]["CommandId"]
    for _ in range(timeout // 10):
        time.sleep(8)
        inv = ssm.get_command_invocation(CommandId=cid, InstanceId=INSTANCE)
        if inv["Status"] in ("Success", "Failed", "Cancelled", "TimedOut"):
            out = inv["StandardOutputContent"]
            err = inv["StandardErrorContent"]
            return (0 if inv["Status"] == "Success" else 1), out + (
                f"\n[stderr] {err[:1500]}" if err.strip() else ""
            )
    return 1, "[timeout]"


print("== 1. create release archive (git archive main) ==")
subprocess.run(["git", "archive", "main", "-o", "/tmp/stibo-hub-release.tar.gz"], cwd=PROJECT, check=True)
print("archive:", os.path.getsize("/tmp/stibo-hub-release.tar.gz"), "bytes")

print("== 2. stage release to S3 ==")
s3.upload_file("/tmp/stibo-hub-release.tar.gz", BUCKET, STAGE_KEY)
print(f"s3://{BUCKET}/{STAGE_KEY}")
has_secret = os.path.exists("/tmp/stibo-env.secret")
if has_secret:
    s3.upload_file("/tmp/stibo-env.secret", BUCKET, SECRET_KEY)
    print("staged stibo env secret merge file")

print("== 3. extract + env ==")
reset_part = (
    "sudo docker compose --project-directory repo -f repo/docker-compose.aws.yml "
    "--env-file /opt/stibo-hub/.env down -v 2>&1 | tail -2;"
) if RESET else ""
code, out = sh(
    f"aws s3 cp s3://{BUCKET}/{STAGE_KEY} /tmp/release.tar.gz && "
    "cd /opt/stibo-hub && "
    "[ -f /opt/stibo-hub/.env ] || sudo sh -c 'printf \"DB_PASSWORD=%s\\nAUTH_SECRET=%s\\n\" \"$(openssl rand -hex 16)\" \"$(openssl rand -hex 32)\" > /opt/stibo-hub/.env'; "
    "sudo chmod 600 /opt/stibo-hub/.env; "
    f"{reset_part}"
    "sudo rm -rf repo.tmp && sudo mkdir repo.tmp && sudo tar -xzf /tmp/release.tar.gz -C repo.tmp; "
    "[ -d repo ] && sudo mv repo repo.old || true; sudo mv repo.tmp repo; "
    "rm -f /tmp/release.tar.gz; echo EXTRACTED"
)
print(out)
if code != 0:
    sys.exit("extract failed")

if has_secret:
    code, out = sh(
        f"aws s3 cp s3://{BUCKET}/{SECRET_KEY} /tmp/stibo-env.secret && "
        "while IFS='=' read -r k v; do "
        "[ -z \"$k\" ] && continue; case \"$k\" in \\#*) continue;; esac; "
        "if sudo grep -q \"^$k=\" /opt/stibo-hub/.env; then "
        "sudo sed -i \"s|^$k=.*|$k=$v|\" /opt/stibo-hub/.env; "
        "else echo \"$k=$v\" | sudo tee -a /opt/stibo-hub/.env > /dev/null; fi; done < /tmp/stibo-env.secret; "
        "sudo chmod 600 /opt/stibo-hub/.env; rm -f /tmp/stibo-env.secret; "
        "echo 'ENV KEYS:'; sudo grep -o '^[A-Z_]*' /opt/stibo-hub/.env | sort | tr '\\n' ' '"
    )
    print(out)
    if code != 0:
        sys.exit("env merge failed")

print("== 4. build & start (this can take a few minutes) ==")
code, out = sh(
    "cd /opt/stibo-hub && sudo docker compose --project-directory repo "
    "--env-file /opt/stibo-hub/.env -f repo/docker-compose.aws.yml up -d --build 2>&1 | tail -8",
    timeout=2400,
)
print(out)
if code != 0:
    sys.exit("build failed")

print("== 5. cleanup + prune ==")
code, out = sh(
    "sudo rm -rf /opt/stibo-hub/repo.old; sudo docker image prune -f 2>/dev/null | tail -1; echo CLEANED"
)
print(out)

print("== 6. verify ==")
time.sleep(6)
code, out = sh(
    "curl -sf http://localhost/api/health && echo && "
    "curl -sf -o /dev/null -w 'root http %{http_code}\\n' http://localhost/"
)
print(out)
if code != 0:
    sys.exit("health check failed")

print("== 7. sync English doc pages into prod DB ==")
dump = subprocess.run(
    ["bun", "-e",
     "import('./prisma/seed-data/docs.mjs').then(m => console.log(JSON.stringify(m.DOCS)))"],
    cwd=PROJECT, capture_output=True, text=True, check=True,
)
DOCS = json.loads(dump.stdout.strip().splitlines()[-1])
if DOCS:
    def esc(s: str) -> str:
        return s.replace("'", "''").replace("\\", "\\\\")
    stmts = []
    for d in DOCS:
        stmts.append(
            f"UPDATE \"DocPage\" SET title='{esc(d['title'])}', category='{esc(d['category'])}', "
            f"\"order\"={int(d['order'])}, summary='{esc(d['summary'])}', body='{esc(d['body'])}', "
            f"\"updatedAt\"=now() WHERE slug='{esc(d['slug'])}';"
        )
    sql = "\n".join(stmts)
    with open("/tmp/docs-sync.sql", "w") as f:
        f.write(sql)
    s3.upload_file("/tmp/docs-sync.sql", BUCKET, "deploys/docs-sync.sql")
    os.remove("/tmp/docs-sync.sql")
    code, out = sh(
        f"aws s3 cp s3://{BUCKET}/deploys/docs-sync.sql /tmp/docs-sync.sql && "
        "cd /opt/stibo-hub && sudo docker compose --project-directory repo "
        "-f repo/docker-compose.aws.yml --env-file /opt/stibo-hub/.env exec -T stibo-hub-db "
        "psql -U stibohub -d stibohub < /tmp/docs-sync.sql 2>&1 | tail -3; rm -f /tmp/docs-sync.sql"
    )
    print(out)
else:
    print("no DOCS parsed — skipping")

print("== 8. clear staged deploy artifacts ==")
s3.delete_object(Bucket=BUCKET, Key=STAGE_KEY)
if has_secret:
    s3.delete_object(Bucket=BUCKET, Key=SECRET_KEY)
s3.delete_object(Bucket=BUCKET, Key="deploys/docs-sync.sql")
print("DEPLOY DONE (via SSM — port 22 stays closed)")
