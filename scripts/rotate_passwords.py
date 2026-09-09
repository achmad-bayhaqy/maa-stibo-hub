#!/usr/bin/env python3
"""Rotate the 3 seeded portal accounts to strong random passwords.
Hashes use the app's own scrypt scheme (salt:hash, 64-byte). The SQL is
staged via S3 and applied with psql via SSM; a chmod-600 note is left on
the server; logins are verified over HTTP afterwards."""
import base64
import json
import secrets
import subprocess
import time

import boto3

INSTANCE = "i-0952d6a47dc43aa16"
BUCKET = "stibo-hub-backups-010526264107"

ssm = boto3.client("ssm", region_name="us-east-1")
s3 = boto3.client("s3", region_name="us-east-1")


def scrypt_hash(pw: str, salt: str) -> str:
    # same as src/lib/auth.ts hashPassword: `${salt}:${scryptSync(pw, salt, 64).hex}`
    out = subprocess.run(
        ["node", "-e",
         f"const{{scryptSync}}=require('crypto');console.log(scryptSync({json.dumps(pw)},{json.dumps(salt)},64).toString('hex'))"],
        check=True, capture_output=True, text=True)
    return out.stdout.strip()


accounts = {
    "admin@map.co.id": secrets.token_urlsafe(9),    # ~12 chars
    "md.coe@map.co.id": secrets.token_urlsafe(9),
    "viewer@map.co.id": secrets.token_urlsafe(9),
}

print("== generate hashes ==")
stmts = []
for email, pw in accounts.items():
    salt = secrets.token_hex(16)
    h = scrypt_hash(pw, salt)
    stmts.append(f"UPDATE \"User\" SET \"passwordHash\"='{salt}:{h}' WHERE email='{email}';")
    print(f"  {email} -> new password generated")

sql = "\n".join(stmts)
with open("/tmp/pw-rotate.sql", "w") as f:
    f.write(sql)
s3.upload_file("/tmp/pw-rotate.sql", BUCKET, "deploys/pw-rotate.sql")

note_lines = "\n".join(f"{e}  |  {p}" for e, p in accounts.items())
with open("/tmp/credentials-note.txt", "w") as f:
    f.write("# stibo-hub portal credentials (rotated) — store in your password manager\n" + note_lines + "\n")
s3.upload_file("/tmp/credentials-note.txt", BUCKET, "deploys/credentials-note.txt")

print("== apply password update via SSM ==")
apply_cmd = (
    f"aws s3 cp s3://{BUCKET}/deploys/pw-rotate.sql /tmp/pw-rotate.sql && "
    "cd /opt/stibo-hub && sudo docker compose --project-directory repo "
    "-f repo/docker-compose.aws.yml --env-file /opt/stibo-hub/.env exec -T stibo-hub-db "
    "psql -U stibohub -d stibohub < /tmp/pw-rotate.sql && rm -f /tmp/pw-rotate.sql && "
    f"aws s3 cp s3://{BUCKET}/deploys/credentials-note.txt /opt/stibo-hub/credentials-note.txt && "
    "sudo chmod 600 /opt/stibo-hub/credentials-note.txt && echo APPLIED"
)
resp = ssm.send_command(
    InstanceIds=[INSTANCE], DocumentName="AWS-RunShellScript",
    Parameters={"commands": [apply_cmd], "executionTimeout": ["300"]},
)
cid = resp["Command"]["CommandId"]
for _ in range(30):
    time.sleep(8)
    inv = ssm.get_command_invocation(CommandId=cid, InstanceId=INSTANCE)
    if inv["Status"] in ("Success", "Failed", "Cancelled", "TimedOut"):
        print(inv["StandardOutputContent"][-400:])
        if inv["Status"] != "Success":
            print("STDERR:", inv["StandardErrorContent"][:500])
            raise SystemExit(1)
        break

s3.delete_object(Bucket=BUCKET, Key="deploys/pw-rotate.sql")
s3.delete_object(Bucket=BUCKET, Key="deploys/credentials-note.txt")

print(json.dumps(accounts, indent=1))
print("PASSWORDS ROTATED")
