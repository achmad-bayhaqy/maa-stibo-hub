#!/usr/bin/env python3
"""Deploy STIBO Hub release to stibo-hub-ec2 via SFTP+SSH (no AWS credentials).

Usage: python3 scripts/deploy_ssh.py [reset]
  reset — also wipe the docker volume (fresh DB + re-seed).
"""
import sys
import paramiko

HOST = "18.232.147.244"
KEY = "/home/z/my-project/download/stibo-hub-key.pem"
RESET = len(sys.argv) > 1 and sys.argv[1] == "reset"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="ec2-user", key_filename=KEY, timeout=20, banner_timeout=20)

def run(cmd: str, timeout: int = 1200) -> str:
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    return o + (("\n[stderr] " + e[:800]) if e.strip() else "")

sftp = c.open_sftp()
sftp.put("/tmp/stibo-hub-release.tar.gz", "/tmp/release.tar.gz")
print("uploaded:", sftp.stat("/tmp/release.tar.gz").st_size, "bytes")
sftp.close()

print(run("set -e; cd /opt/stibo-hub; "
          "[ -f /opt/stibo-hub/.env ] || sudo sh -c 'printf \"DB_PASSWORD=%s\\nAUTH_SECRET=%s\\n\" \"$(openssl rand -hex 16)\" \"$(openssl rand -hex 32)\" > /opt/stibo-hub/.env'; "
          "sudo chmod 600 /opt/stibo-hub/.env; "
          "sudo rm -rf repo.tmp && sudo mkdir repo.tmp && sudo tar -xzf /tmp/release.tar.gz -C repo.tmp; "
          "[ -d repo ] && sudo mv repo repo.old || true; sudo mv repo.tmp repo; "
          "echo EXTRACTED"))

if RESET:
    print(run("cd /opt/stibo-hub && sudo docker compose --env-file /opt/stibo-hub/.env -f repo/docker-compose.aws.yml down -v 2>&1 | tail -3"))

print(run("cd /opt/stibo-hub && sudo docker compose --project-directory repo --env-file /opt/stibo-hub/.env -f repo/docker-compose.aws.yml up -d --build 2>&1 | tail -8", timeout=1800))
print(run("rm -f /tmp/release.tar.gz; sudo rm -rf /opt/stibo-hub/repo.old; echo CLEANED"))
c.close()
