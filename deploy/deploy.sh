#!/usr/bin/env bash
set -Eeuo pipefail

SHA="${1:-origin/main}"
APP_ROOT="${AVALON_APP_ROOT:-/srv/avalon}"
REPO_DIR="$APP_ROOT/repo"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"
KEEP_RELEASES="${AVALON_KEEP_RELEASES:-4}"
HEALTH_URL="${AVALON_HEALTH_URL:-http://127.0.0.1:4173/}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Avalon repository is missing at $REPO_DIR" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR"

git -C "$REPO_DIR" fetch --prune origin main
REVISION="$(git -C "$REPO_DIR" rev-parse --verify "${SHA}^{commit}")"
RELEASE_DIR="$RELEASES_DIR/$REVISION"
PREVIOUS_RELEASE=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  git -C "$REPO_DIR" worktree add --detach "$RELEASE_DIR" "$REVISION"
fi

cd "$RELEASE_DIR"
npm ci
npm run build

NEXT_LINK="$APP_ROOT/.current-$REVISION"
ln -sfn "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

sudo /usr/bin/systemctl restart avalon.service

healthy=false
for _ in {1..15}; do
  if curl --fail --silent --show-error --max-time 3 "$HEALTH_URL" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != true ]]; then
  echo "Avalon failed its post-deploy health check." >&2
  if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    echo "Rolling back to $PREVIOUS_RELEASE" >&2
    ROLLBACK_LINK="$APP_ROOT/.rollback-current"
    ln -sfn "$PREVIOUS_RELEASE" "$ROLLBACK_LINK"
    mv -Tf "$ROLLBACK_LINK" "$CURRENT_LINK"
    sudo /usr/bin/systemctl restart avalon.service
  fi
  exit 1
fi

# Keep a few known-good releases so a rollback never depends on rebuilding.
mapfile -t OLD_RELEASES < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | awk -v keep="$KEEP_RELEASES" 'NR > keep {print $2}'
)
for release in "${OLD_RELEASES[@]:-}"; do
  [[ -z "$release" ]] && continue
  [[ "$(readlink -f "$CURRENT_LINK")" == "$release" ]] && continue
  git -C "$REPO_DIR" worktree remove --force "$release" 2>/dev/null || rm -rf "$release"
done
git -C "$REPO_DIR" worktree prune

echo "Avalon deployed: $REVISION"
