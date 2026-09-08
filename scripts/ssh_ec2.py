#!/usr/bin/env python3
"""SSH diagnostics + command runner for stibo-hub-ec2 via paramiko."""
import sys, paramiko

HOST = "18.232.147.244"
KEY = "/home/z/my-project/download/stibo-hub-key.pem"

def run(cmd: str, timeout: int = 60) -> str:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="ec2-user", key_filename=KEY, timeout=20, banner_timeout=20)
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    c.close()
    return o + (("\n[stderr] " + e[:500]) if e.strip() else "")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "hostname"
    print(run(cmd, timeout=int(sys.argv[2]) if len(sys.argv) > 2 else 60))
