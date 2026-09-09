#!/usr/bin/env python3
"""One-time (idempotent) installation of the stibo-hub DB backup job via SSM:
installs /opt/stibo-hub/backup.sh, root crontab entry (02:30 UTC daily),
runs one backup immediately and verifies the S3 upload."""
import subprocess
import sys
import time

import boto3

INSTANCE = "i-0952d6a47dc43aa16"
BUCKET = "stibo-hub-backups-010526264107"

ssm = boto3.client("ssm", region_name="us-east-1")
s3 = boto3.client("s3", region_name="us-east-1")


def sh(cmd: str, timeout: int = 600) -> tuple[int, str]:
    resp = ssm.send_command(
        InstanceIds=[INSTANCE],
        DocumentName="AWS-RunShellScript",
        TimeoutSeconds=300,
        Parameters={"commands": [cmd], "executionTimeout": [str(timeout)]},
    )
    cid = resp["Command"]["CommandId"]
    for _ in range(timeout // 8):
        time.sleep(8)
        inv = ssm.get_command_invocation(CommandId=cid, InstanceId=INSTANCE)
        if inv["Status"] in ("Success", "Failed", "Cancelled", "TimedOut"):
            return (0 if inv["Status"] == "Success" else 1), inv["StandardOutputContent"] + (
                f"\n[stderr] {inv['StandardErrorContent'][:800]}" if inv["StandardErrorContent"].strip() else ""
            )
    return 1, "[timeout]"


print("== upload backup.sh to S3 staging ==")
s3.upload_file("/home/z/my-project/scripts/backup.sh", BUCKET, "deploys/backup.sh")

print("== install on instance ==")
install_cmd = (
    "command -v crontab >/dev/null || (dnf install -y -q cronie && systemctl enable --now crond); "
    f"aws s3 cp s3://{BUCKET}/deploys/backup.sh /opt/stibo-hub/backup.sh && "
    "chmod 700 /opt/stibo-hub/backup.sh && "
    "(sudo crontab -l 2>/dev/null | grep -v stibo-hub/backup.sh; "
    "echo '30 2 * * * /opt/stibo-hub/backup.sh >> /var/log/stibo-backup.log 2>&1') | sudo crontab - && "
    "echo CRON-INSTALLED && sudo crontab -l | tail -2"
)
code, out = sh(install_cmd)
print(out)
if code != 0:
    sys.exit("backup install failed")

print("== run one backup now ==")
code, out = sh("/opt/stibo-hub/backup.sh", timeout=300)
print(out)
if code != 0:
    sys.exit("first backup failed")

print("== verify S3 object ==")
objs = s3.list_objects_v2(Bucket=BUCKET, Prefix="postgres/").get("Contents", [])
for o in objs:
    print(f"  s3://{BUCKET}/{o['Key']}  {o['Size']} bytes")
if not objs:
    sys.exit("no backup objects found in S3")
s3.delete_object(Bucket=BUCKET, Key="deploys/backup.sh")
print("BACKUP AUTOMATION READY (daily 02:30 UTC)")
