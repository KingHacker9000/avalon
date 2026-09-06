# Production deployment — Lightsail + Caddy

Recommended production layout:

- Avalon runs directly on the Lightsail instance on `127.0.0.1:4173`.
- Caddy terminates HTTPS for `avalon.ashishajin.com` and reverse-proxies to Avalon.
- Room state lives outside the Git checkout at `/var/lib/avalon/avalon.sqlite`.
- Every push to `main` is validated by GitHub Actions and then deployed automatically when `AVALON_AUTODEPLOY=true`.
- Deployments use versioned release directories and automatically roll back the `current` symlink if the post-restart health check fails.

## 1. DNS and firewall

Give the Lightsail instance a static IP. Add an `A` record:

```text
avalon.ashishajin.com -> LIGHTSAIL_STATIC_IP
```

Allow inbound TCP 80 and 443 in the Lightsail firewall. SSH/22 should remain limited as tightly as practical.

## 2. One-time server bootstrap

These instructions assume the normal Ubuntu Lightsail user is `ubuntu` and Node 24 is installed system-wide so `/usr/bin/npm` exists.

```bash
sudo mkdir -p /srv/avalon/releases /var/lib/avalon
sudo chown -R ubuntu:ubuntu /srv/avalon /var/lib/avalon

git clone https://github.com/KingHacker9000/avalon.git /srv/avalon/repo
cd /srv/avalon/repo

sudo cp deploy/avalon.service /etc/systemd/system/avalon.service
sudo systemctl daemon-reload
sudo systemctl enable avalon.service

# Allow the deploy account to restart this service and nothing broader.
echo 'ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart avalon.service' \
  | sudo tee /etc/sudoers.d/avalon-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/avalon-deploy
sudo visudo -cf /etc/sudoers.d/avalon-deploy

bash deploy/deploy.sh "$(git rev-parse HEAD)"
```

Check it locally on the server:

```bash
curl -I http://127.0.0.1:4173/
systemctl status avalon.service --no-pager
```

The database is deliberately outside the release tree. Do not move `AVALON_DATA_DIR` back inside the repository for production.

## 3. Caddy

Merge the contents of `deploy/Caddyfile.avalon` into the existing Caddy configuration. If the server's main Caddyfile already imports a snippets directory, placing the file there is fine instead.

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Once DNS points at this Lightsail instance, Caddy will obtain and renew HTTPS certificates automatically.

## 4. GitHub deployment credentials

Create a dedicated SSH key for GitHub Actions rather than uploading a personal key if possible.

On your own computer:

```bash
ssh-keygen -t ed25519 -f avalon_github_deploy -C avalon-github-deploy
```

Append `avalon_github_deploy.pub` to `/home/ubuntu/.ssh/authorized_keys` on Lightsail. Keep the private file secret.

After you have manually connected to the server once and verified its SSH host fingerprint, collect its known-hosts entry for GitHub Actions. For example:

```bash
ssh-keyscan -H LIGHTSAIL_STATIC_IP
```

In the Avalon repository, add these **Actions secrets**:

- `LIGHTSAIL_HOST` — Lightsail static IP or SSH hostname
- `LIGHTSAIL_USER` — `ubuntu`
- `LIGHTSAIL_SSH_KEY` — complete contents of the dedicated private key
- `LIGHTSAIL_KNOWN_HOSTS` — the verified known-hosts line(s)

Then add this **Actions repository variable**:

```text
AVALON_AUTODEPLOY=true
```

Until that variable is exactly `true`, normal CI still runs but production deployment is skipped. This prevents the workflow from failing while credentials are being configured.

## 5. What happens on each push to main

GitHub Actions runs, in order:

1. `npm ci`
2. `npm test`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run build`
6. SSH to Lightsail only if all validation passed
7. Fetch the exact tested commit
8. Build it in `/srv/avalon/releases/<commit>`
9. Atomically point `/srv/avalon/current` at that release
10. Restart `avalon.service`
11. Health-check `http://127.0.0.1:4173/`
12. Roll back to the previous release automatically if that health check fails

The SQLite room database at `/var/lib/avalon` is untouched by application releases.

## Useful production commands

```bash
sudo systemctl status avalon.service --no-pager
sudo journalctl -u avalon.service -n 100 --no-pager
sudo systemctl status caddy --no-pager
curl -I https://avalon.ashishajin.com/
```
