#!/usr/bin/env python3
"""Run a command on stibo-hub-ec2 via a freshly pushed EC2 Instance Connect key.

Usage: python3 scripts/eic_run.py "<remote command>"
Pushes ~/.ssh/stibo-eic.pub to the instance with `aws ec2-instance-connect
send-ssh-public-key` (valid ~60s) then executes via paramiko.
"""
import os
import subprocess
import sys

import paramiko

CMD = sys.argv[1] if len(sys.argv) > 1 else "echo no-cmd"
HOST = "18.232.147.244"
INSTANCE = "i-0952d6a47dc43aa16"
KEY = os.path.expanduser("~/.ssh/stibo-eic")


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


push_key()
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="ec2-user", key_filename=KEY, timeout=20, banner_timeout=20)
_, out, err = c.exec_command(CMD, timeout=1800)
o = out.read().decode(errors="replace")
e = err.read().decode(errors="replace")
c.close()
print(o)
if e.strip():
    print("[stderr]", e[:2000], file=sys.stderr)
