# Production deployment — Raspberry Pi 5 + Lightsail Caddy

Production layout:

```text
Internet
  -> HTTPS 443
  -> AWS Lightsail / Caddy
  -> Tailscale
  -> Raspberry Pi 5 100.113.112.87:4173
  -> Avalon / Vinext
  -> /var/lib/avalon/avalon.sqlite
```

Deployment layout:

```text
push/merge to main
  -> GitHub Actions validates tests/typecheck/lint/build/API smoke
  -> restricted SSH to Lightsail
  -> restricted SSH over Tailscale to Pi:2222
  -> deploy exact tested commit
  -> atomic release switch
  -> restart + health check
  -> automatic rollback on health-check failure
```

Lightsail remains the only public HTTP/HTTPS edge. Port 4173 on the Pi is private to Tailscale and must not be forwarded from the home router or opened on the Lightsail public firewall.

## Addresses and paths

- Public hostname: `avalon.ashishajin.com`
- Lightsail public IP: `16.52.123.66`
- Lightsail Tailscale IP: `100.92.214.76`
- Pi Tailscale IP: `100.113.112.87`
- Pi app listener: `100.113.112.87:4173`
- Pi repository: `/srv/avalon/repo`
- Pi releases: `/srv/avalon/releases`
- Pi active release: `/srv/avalon/current`
- Pi persistent SQLite data: `/var/lib/avalon`
- Pi restricted deployment SSH: `100.113.112.87:2222`
- Lightsail Caddy route: `/etc/caddy/conf.d/avalon.caddy`

## 1. DNS

Create an A record:

```text
avalon.ashishajin.com -> 16.52.123.66
```

Lightsail should expose only the normal public web ports required by Caddy (TCP 80 and 443). Do **not** expose Pi port 4173 publicly.

## 2. Preflight on the Raspberry Pi

Run before installing anything:

```bash
node -v
npm -v
git --version
tailscale ip -4
free -h
df -h /
sudo ss -lntup | grep -E '(:4173|:2222)' || true
systemctl is-active tailscaled
```

Avalon requires Node 24 or newer. Install a system-wide Node 24 release before continuing if `node -v` is older. `/usr/bin/node` and `/usr/bin/npm` should exist because systemd does not use an interactive shell profile.

The existing restricted OpenSSH listener on Pi port 2222 may be shared with the YT deployment; use a **separate key** and forced command for Avalon.

## 3. Bootstrap Avalon on the Pi

As `ashish`:

```bash
sudo mkdir -p /srv/avalon/releases /var/lib/avalon
sudo chown -R ashish:ashish /srv/avalon /var/lib/avalon

git clone https://github.com/KingHacker9000/avalon.git /srv/avalon/repo
cd /srv/avalon/repo

sudo install -o root -g root -m 0644 \
  deploy/avalon.service \
  /etc/systemd/system/avalon.service

sudo install -o root -g root -m 0755 \
  deploy/pi/deploy-avalon-worker \
  /usr/local/sbin/deploy-avalon-worker

sudo systemctl daemon-reload
sudo systemctl enable avalon.service

# The release script needs only this narrowly scoped privilege.
printf '%s\n' \
  'ashish ALL=(root) NOPASSWD: /usr/bin/systemctl restart avalon.service' \
  | sudo tee /etc/sudoers.d/avalon-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/avalon-deploy
sudo visudo -cf /etc/sudoers.d/avalon-deploy

AVALON_HEALTH_URL=http://100.113.112.87:4173/ \
  bash deploy/deploy.sh "$(git rev-parse HEAD)"
```

Verify:

```bash
systemctl status avalon.service --no-pager
sudo journalctl -u avalon.service -n 100 --no-pager
curl -fsSI http://100.113.112.87:4173/
sudo ss -lntp | grep ':4173'
```

The database is intentionally outside every release directory. Never move production `AVALON_DATA_DIR` into the Git checkout.

## 4. Install the Caddy route on Lightsail

From the Avalon repository, `deploy/Caddyfile.avalon` proxies the public hostname to `100.113.112.87:4173` over Tailscale.

On Lightsail, create `/etc/caddy/conf.d/avalon.caddy` with the same contents, then:

```bash
curl -fsSI http://100.113.112.87:4173/

sudo /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

After DNS has propagated:

```bash
curl -fsSI https://avalon.ashishajin.com/
```

Caddy obtains and renews the HTTPS certificate automatically.

## 5. Lightsail -> Pi restricted deployment key

Generate a dedicated key **on Lightsail**. The private key stays on Lightsail.

```bash
install -m 700 -d /home/ubuntu/.ssh
ssh-keygen -t ed25519 \
  -N '' \
  -f /home/ubuntu/.ssh/avalon_pi_deploy \
  -C avalon-lightsail-to-pi
chmod 600 /home/ubuntu/.ssh/avalon_pi_deploy
```

Copy the resulting `.pub` line to the Pi and append it to `/home/ashish/.ssh/authorized_keys` with this forced-command prefix:

```text
command="/usr/local/sbin/deploy-avalon-worker",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <PUBLIC_KEY_LINE>
```

Do not replace the existing YT authorized key; append a separate Avalon line.

Pin the Pi port-2222 host key on Lightsail:

```bash
ssh-keyscan -p 2222 -H 100.113.112.87 \
  > /home/ubuntu/.ssh/avalon_pi_known_hosts
chmod 600 /home/ubuntu/.ssh/avalon_pi_known_hosts
```

Verify the fingerprint against the Pi's actual SSH host key before trusting it.

Test the restricted hop from Lightsail using a real commit from `main`:

```bash
SHA=$(git ls-remote https://github.com/KingHacker9000/avalon.git refs/heads/main | awk '{print $1}')
ssh \
  -p 2222 \
  -i /home/ubuntu/.ssh/avalon_pi_deploy \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o UserKnownHostsFile=/home/ubuntu/.ssh/avalon_pi_known_hosts \
  ashish@100.113.112.87 \
  "deploy $SHA"
```

## 6. Install the Lightsail relay

Copy `deploy/lightsail/deploy-avalon-relay` to Lightsail:

```bash
sudo install -o root -g root -m 0755 \
  deploy/lightsail/deploy-avalon-relay \
  /usr/local/sbin/deploy-avalon-relay
```

The relay accepts only `deploy <40-character-sha>` and forwards that request to the Pi using the dedicated key above.

## 7. GitHub Actions -> Lightsail restricted key

Create another dedicated Ed25519 key pair for GitHub Actions. Its **public** key goes on Lightsail; its **private** key goes only into the Avalon repository's Actions secret.

Append the public key to `/home/ubuntu/.ssh/authorized_keys` on Lightsail using:

```text
command="/usr/local/sbin/deploy-avalon-relay",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <PUBLIC_KEY_LINE>
```

The workflow deliberately sends only:

```text
deploy <exact tested GITHUB_SHA>
```

The forced relay and worker both reject arbitrary commands.

## 8. GitHub repository settings

Add repository secret:

- `LIGHTSAIL_SSH_KEY_B64` — base64 of the dedicated GitHub -> Lightsail private key
- `LIGHTSAIL_KNOWN_HOSTS` — verified SSH known-hosts line(s) for Lightsail

Add repository variables:

```text
AVALON_LIGHTSAIL_HOST=16.52.123.66
AVALON_AUTODEPLOY=true
```

On Linux, create the base64 secret value without line wrapping with:

```bash
base64 -w0 avalon_github_deploy
```

Until `AVALON_AUTODEPLOY` is exactly `true`, CI continues to validate every push but deployment is skipped.

## 9. Deployment lifecycle

For every merge/push to `main`:

1. GitHub runs tests, typecheck, lint, production build, and five-client API smoke.
2. GitHub SSHes to Lightsail with a forced-command-only key.
3. Lightsail relays only the tested 40-character commit SHA to the Pi over Tailscale port 2222.
4. The Pi verifies that SHA belongs to `origin/main`.
5. A detached worktree is created at `/srv/avalon/releases/<sha>`.
6. `npm ci` and `npm run build` run on the Pi.
7. `/srv/avalon/current` switches atomically to the new release.
8. `avalon.service` restarts.
9. The Pi health-checks `http://100.113.112.87:4173/`.
10. On failure, the symlink rolls back to the previous release and the service restarts.
11. `/var/lib/avalon/avalon.sqlite` is never replaced by an application deployment.

## 10. Operational checks

Pi:

```bash
systemctl status avalon.service --no-pager
sudo journalctl -u avalon.service -n 100 --no-pager
curl -fsSI http://100.113.112.87:4173/
readlink -f /srv/avalon/current
```

Lightsail:

```bash
curl -fsSI http://100.113.112.87:4173/
sudo /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
sudo systemctl status caddy --no-pager
curl -fsSI https://avalon.ashishajin.com/
```

## 11. Backups

At minimum, back up the SQLite database and WAL/SHM files while the service is stopped or use a SQLite-aware backup procedure. A simple maintenance backup is:

```bash
sudo systemctl stop avalon.service
sudo tar -C /var/lib -czf "/home/ashish/avalon-data-$(date +%F-%H%M%S).tar.gz" avalon
sudo systemctl start avalon.service
```

Application releases do not need to be backed up because they are reproducible from GitHub.

## 12. Reboot validation

After the initial installation, reboot the Pi once and verify that Tailscale and Avalon recover correctly:

```bash
sudo reboot
```

After reconnecting:

```bash
tailscale status
systemctl status avalon.service --no-pager
curl -fsSI http://100.113.112.87:4173/
```

Then verify from Lightsail and finally from the public hostname.
