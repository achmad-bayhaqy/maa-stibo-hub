#!/usr/bin/env python3
"""Deploy latest `main` to stibo-hub-ec2 using EC2 Instance Connect (no static key).

Steps:
  1. git archive main -> release tarball
  2. push temp SSH key via EIC, upload tarball via SFTP
  3. extract to /opt/stibo-hub/repo, ensure /opt/stibo-hub/.env exists,
     ensure STIBO_* credentials are present (from /tmp/stibo-env.secret if provided)
  4. docker compose up -d --build, prune old images, verify /api/health

Usage: python3 scripts/deploy_eic.py [reset]
  reset — also wipe the docker volume (fresh DB + re-seed)
"""
import os
import subprocess
import sys
import time

import paramiko

HOST = "18.232.147.244"
INSTANCE = "i-0952d6a47dc43aa16"
KEY = os.path.expanduser("~/.ssh/stibo-eic")
PROJECT = "/home/z/my-project"
SECRET_SRC = "/tmp/stibo-env.secret"  # optional: STIBO_* lines to merge into server .env
RESET = len(sys.argv) > 1 and sys.argv[1] == "reset"


def push_key():
    env = os.environ.copy()
    env.setdefault("AWS_DEFAULT_REGION", "us-east-1")
    subprocess.run(
        [
            os.path.expanduser("~/.local/bin/aws"),
            "ec2-instance-connect", "send-ssh-public-key",
            "--instance-id", INSTANCE,
            "--instance-os-user", "ec2-user",
            "--ssh-public-key", f"file://{KEY}.pub",
            "--output", "text",
        ],
        check=True, capture_output=True, env=env,
    )


def connect():
    push_key()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="ec2-user", key_filename=KEY, timeout=20, banner_timeout=20)
    return c


def run(c, cmd, timeout=1800):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    code = out.channel.recv_exit_status()
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    return code, o + (("\n[stderr] " + e[:1500]) if e.strip() else "")


print("== 1. create release archive (git archive main) ==")
subprocess.run(["git", "archive", "main", "-o", "/tmp/stibo-hub-release.tar.gz"], cwd=PROJECT, check=True)
print("archive:", os.path.getsize("/tmp/stibo-hub-release.tar.gz"), "bytes")

c = connect()

print("== 2. upload release ==")
sftp = c.open_sftp()
sftp.put("/tmp/stibo-hub-release.tar.gz", "/tmp/release.tar.gz")
print("uploaded:", sftp.stat("/tmp/release.tar.gz").st_size, "bytes")
has_secret = os.path.exists(SECRET_SRC)
if has_secret:
    sftp.put(SECRET_SRC, "/tmp/stibo-env.secret")
    print("uploaded stibo env secret merge file")
sftp.close()

print("== 3. extract + env ==")
code, out = run(c, "set -e; cd /opt/stibo-hub; "
                  "[ -f /opt/stibo-hub/.env ] || sudo sh -c 'printf \"DB_PASSWORD=%s\\nAUTH_SECRET=%s\\n\" \"$(openssl rand -hex 16)\" \"$(openssl rand -hex 32)\" > /opt/stibo-hub/.env'; "
                  "sudo chmod 600 /opt/stibo-hub/.env; "
                  "sudo rm -rf repo.tmp && sudo mkdir repo.tmp && sudo tar -xzf /tmp/release.tar.gz -C repo.tmp; "
                  "[ -d repo ] && sudo mv repo repo.old || true; sudo mv repo.tmp repo; "
                  "echo EXTRACTED")
print(out)
if code != 0:
    sys.exit("extract failed")

if has_secret:
    code, out = run(c,
        "set -e; while IFS='=' read -r k v; do "
        "[ -z \"$k\" ] && continue; case \"$k\" in \\#*) continue;; esac; "
        "if grep -q \"^$k=\" /opt/stibo-hub/.env; then "
        "sudo sed -i \"s|^$k=.*|$k=$v|\" /opt/stibo-hub/.env; "
        "else echo \"$k=$v\" | sudo tee -a /opt/stibo-hub/.env > /dev/null; fi; done < /tmp/stibo-env.secret; "
        "sudo chmod 600 /opt/stibo-hub/.env; rm -f /tmp/stibo-env.secret; "
        "echo 'ENV KEYS:'; sudo grep -o '^[A-Z_]*' /opt/stibo-hub/.env | sort | tr '\\n' ' '")
    print(out)
    if code != 0:
        sys.exit("env merge failed")

if RESET:
    print("== 3b. reset volume ==")
    code, out = run(c, "cd /opt/stibo-hub && sudo docker compose --env-file /opt/stibo-hub/.env -f repo/docker-compose.aws.yml down -v 2>&1 | tail -3")
    print(out)

print("== 4. build & start (this can take a few minutes) ==")
code, out = run(c, "cd /opt/stibo-hub && sudo docker compose --project-directory repo --env-file /opt/stibo-hub/.env -f repo/docker-compose.aws.yml up -d --build 2>&1 | tail -8", timeout=2400)
print(out)
if code != 0:
    sys.exit("build failed")

print("== 5. cleanup + prune ==")
code, out = run(c, "rm -f /tmp/release.tar.gz; sudo rm -rf /opt/stibo-hub/repo.old; sudo docker image prune -f 2>/dev/null | tail -1; echo CLEANED")
print(out)

print("== 6. verify ==")
time.sleep(6)
code, out = run(c, "curl -sf http://localhost/api/health && echo && curl -sf -o /dev/null -w 'root http %{http_code}\\n' http://localhost/")
print(out)

print("== 7. sync English doc pages into prod DB ==")
dump = subprocess.run(
    ["bun", "-e",
     "import('./prisma/seed-data/docs.mjs').then(m => console.log(JSON.stringify(m.DOCS)))"],
    cwd=PROJECT, capture_output=True, text=True, check=True,
)
DOCS = __import__("json").loads(dump.stdout.strip().splitlines()[-1])
if DOCS:
    def esc(s: str) -> str:
        return s.replace("'", "''")
    # container entrypoint already seeds DocPages (idempotent); this is an
    # UPDATE-only safety net — never inserts (id is generated client-side)
    stmts = []
    for d in DOCS:
        stmts.append(
            f"UPDATE \"DocPage\" SET title='{esc(d['title'])}', category='{esc(d['category'])}', "
            f"\"order\"={int(d['order'])}, summary='{esc(d['summary'])}', body='{esc(d['body'])}', "
            f"\"updatedAt\"=now() WHERE slug='{esc(d['slug'])}';"
        )
    sql = "\n".join(stmts)
    sftp2 = c.open_sftp()
    with sftp2.open("/tmp/docs-sync.sql", "w") as f:
        f.write(sql)
    sftp2.close()
    code, out = run(c, "cd /opt/stibo-hub && sudo docker compose --project-directory repo -f repo/docker-compose.aws.yml --env-file /opt/stibo-hub/.env exec -T stibo-hub-db psql -U stibohub -d stibohub < /tmp/docs-sync.sql 2>&1 | tail -3; rm -f /tmp/docs-sync.sql")
    print(out)
else:
    print("no DOCS parsed — skipping")

c.close()
print("DEPLOY DONE")
