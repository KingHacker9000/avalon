# Isolated Node 24 runtime on Raspberry Pi

Avalon uses `/opt/node-v24` instead of replacing the Pi's system-wide Node.js installation. This avoids changing Node versions for unrelated services already using `/usr/bin/node`.

Install the latest Node 24 ARM64 release from nodejs.org and verify its published SHA256 checksum:

```bash
set -Eeuo pipefail
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"

curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
archive="$(awk '/node-v[0-9.]+-linux-arm64\.tar\.xz$/ {print $2; exit}' SHASUMS256.txt)"
test -n "$archive"
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$archive"
grep "  $archive$" SHASUMS256.txt | sha256sum -c -

sudo rm -rf /opt/node-v24.new
sudo mkdir -p /opt/node-v24.new
sudo tar -xJf "$archive" --strip-components=1 -C /opt/node-v24.new
sudo chown -R root:root /opt/node-v24.new

if [ -d /opt/node-v24 ]; then
  sudo rm -rf /opt/node-v24.previous
  sudo mv /opt/node-v24 /opt/node-v24.previous
fi
sudo mv /opt/node-v24.new /opt/node-v24

PATH=/opt/node-v24/bin:$PATH node -v
PATH=/opt/node-v24/bin:$PATH npm -v
/usr/bin/node -v
```

The final `/usr/bin/node -v` is expected to remain whatever version the Pi was already using. Avalon systemd and restricted deployment scripts prepend `/opt/node-v24/bin` to their own PATH.
