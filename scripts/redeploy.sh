#!/bin/bash
# Redeploy STIBO Hub to the EC2 instance (rsync-style: archive → S3 → presign → ssh pull → rebuild)
set -euo pipefail
cd /home/z/my-project

git archive main -o /tmp/stibo-hub-release.tar.gz
export AWS_DEFAULT_REGION="us-east-1" \
  AWS_ACCESS_KEY_ID="ASIAQE43KBMVUWNYOJJO" \
  AWS_SECRET_ACCESS_KEY="gCV46MFnfq9nuuixWRCV0ZKjTR7ayX28rvz9RRYp" \
  AWS_SESSION_TOKEN="IQoJb3JpZ2luX2VjEID//////////wEaCXVzLWVhc3QtMSJHMEUCIDFXmjSSLQoLTFB0G438Jfv1Gf0zra60MU35EvbjrQGJAiEAzvVKoJSON3TX9SpbTDI7T9Pn2DeoPtN+a7PQS8l3d4MqmQIISRAAGgwwMTA1MjYyNjQxMDciDKI8JWOibpzpODmZiCr2ARpkRJMsyC+RD/opVMw9e6qJNaayky5Y9vS62WVwHkw7ivHWC/atic7xajWUhjAzrWQr4pxlNKP3c0XEEIaV7ImrlsNndIOFmFPnwEv5frUjlniy7tuLzY+LqMFDpuKYSX22ofKJsh56mEMUIcBzq2qYQUIlQun2rYW7mSFxu7Iijhg4w+R3XvdRRER6al0wAU/1gqEcHegPpPeTITc7oQbzkxq+hC2GjI+DHthSY665lmSdB0bKIl2+YEQOXqhsTu/OossqvLW/YNQVnYUNvbaPLCTNt5FoZRyl0umpWZ8V3DzbFYAs1ngC7yYiRNVhXYVq9y/y6jCSkv3UBjqdAWwhOGJ/BYHisvQ9+XgAfoZVAaTPi/gub53Tbvp07kD4QQvzygC0zTqI9V31vpGOzt19EkdFfObKjLzKslpFFN5KaV3/wjutxbzOlBTXhnaTpEKj8Yksfx70Dronf3RxJQOmpSSSMXlAXAfjE2dgE80WGEdwBaH7gNiAMkYfz2lEtR5ZnV06oiwzqcL5s305m2nGegoi3jHNjwdbnVc="
aws s3 cp /tmp/stibo-hub-release.tar.gz s3://stibo-hub-artifacts-010526264107/releases/stibo-hub-main.tar.gz --quiet
PRESIGN=$(aws s3 presign s3://stibo-hub-artifacts-010526264107/releases/stibo-hub-main.tar.gz --expires-in 3600)

IP="18.232.147.244"
RESET_VOLUME="${1:-}"
python3 scripts/ssh_ec2.py "cd /opt/stibo-hub && sudo curl -sSL '$PRESIGN' -o release.tar.gz && sudo rm -rf repo && sudo mkdir repo && sudo tar -xzf release.tar.gz -C repo && cd repo && sudo sh -c 'printf \"DB_PASSWORD=%s\nAUTH_SECRET=%s\n\" \"\$(openssl rand -hex 16)\" \"\$(openssl rand -hex 32)\" > .env' && sudo chmod 600 .env && if [ '$RESET_VOLUME' = 'reset' ]; then sudo docker compose -f docker-compose.aws.yml down -v; fi && sudo docker compose -f docker-compose.aws.yml up -d --build 2>&1 | tail -8" 900
echo "=== redeploy triggered ==="
