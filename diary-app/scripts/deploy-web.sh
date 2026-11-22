#!/usr/bin/env bash
# Deploy a tested export and isolated feedback service; retain a rollback target.
set -euo pipefail
cd "$(dirname "$0")/.."
test -s dist/index.html
test -s dist/release.json
test -s server/feedback.py
target="root@39.105.19.77"
release="$(date -u +%Y%m%dT%H%M%SZ)"
staging="$(mktemp -d /tmp/jide-deploy.XXXXXX)"
trap 'rm -rf "$staging"' EXIT
ssh_opts=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/tmp/jide_known_hosts)
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$staging/site.tar.gz" -C dist .
scp "${ssh_opts[@]}" "$staging/site.tar.gz" "$target:/tmp/jide-$release.tar.gz"
scp "${ssh_opts[@]}" deploy/nginx.conf "$target:/tmp/jide-$release.nginx"
scp "${ssh_opts[@]}" server/feedback.py "$target:/tmp/jide-$release.feedback.py"
scp "${ssh_opts[@]}" deploy/jide-feedback.service "$target:/tmp/jide-$release.service"
ssh "${ssh_opts[@]}" "$target" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
release="$1"
release_dir="/var/www/diary-releases/$release"
feedback_dir="/opt/jide-feedback/releases/$release"
backup_dir="/var/backups/jide/$release"
previous="$(readlink -f /var/www/diary-current 2>/dev/null || true)"
previous_feedback="$(readlink -f /opt/jide-feedback/current 2>/dev/null || true)"
if [ ! -d "$previous" ]; then previous=/var/www/diary; fi
test -s "$previous/index.html"
mkdir -p "$release_dir" "$feedback_dir" "$backup_dir"
cp -a /etc/nginx/sites-available/default "$backup_dir/nginx.conf"
feedback_was_active=0
feedback_was_enabled=0
systemctl is-active --quiet jide-feedback && feedback_was_active=1
systemctl is-enabled --quiet jide-feedback 2>/dev/null && feedback_was_enabled=1
if [ -f /etc/systemd/system/jide-feedback.service ]; then
    cp -a /etc/systemd/system/jide-feedback.service "$backup_dir/jide-feedback.service"
fi
printf '%s\n' "$previous" > "$backup_dir/previous-release"
printf '%s\n' "$previous_feedback" > "$backup_dir/previous-feedback"
# Old browser tabs can still load their previous content-hashed assets.
cp -a "$previous/." "$release_dir/"
tar --no-same-owner -xzf "/tmp/jide-$release.tar.gz" -C "$release_dir"
chmod -R a+rX "$release_dir"
install -m 644 "/tmp/jide-$release.feedback.py" "$feedback_dir/feedback.py"
rollback() {
    trap - ERR
    set +e
    cp -a "$backup_dir/nginx.conf" /etc/nginx/sites-available/default
    ln -sfn "$previous" /var/www/diary-current.rollback
    mv -Tf /var/www/diary-current.rollback /var/www/diary-current
    if [ -f "$backup_dir/jide-feedback.service" ]; then
        cp -a "$backup_dir/jide-feedback.service" /etc/systemd/system/jide-feedback.service
        if [ -n "$previous_feedback" ]; then ln -sfn "$previous_feedback" /opt/jide-feedback/current; fi
    else
        systemctl stop jide-feedback
        systemctl disable jide-feedback
        rm -f /etc/systemd/system/jide-feedback.service
    fi
    systemctl daemon-reload
    if [ "$feedback_was_enabled" = 1 ]; then systemctl enable jide-feedback; else systemctl disable jide-feedback; fi
    if [ "$feedback_was_active" = 1 ]; then systemctl restart jide-feedback; else systemctl stop jide-feedback; fi
    nginx -t && systemctl reload nginx
    printf 'Deployment failed; restored %s\n' "$previous" >&2
    exit 1
}
trap rollback ERR
ln -sfn "$feedback_dir" /opt/jide-feedback/current.next
mv -Tf /opt/jide-feedback/current.next /opt/jide-feedback/current
install -m 644 "/tmp/jide-$release.service" /etc/systemd/system/jide-feedback.service
systemctl daemon-reload
systemctl restart jide-feedback
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 --max-time 5 http://127.0.0.1:18971/api/feedback/health
ln -sfn "$release_dir" /var/www/diary-current.next
mv -Tf /var/www/diary-current.next /var/www/diary-current
install -m 644 "/tmp/jide-$release.nginx" /etc/nginx/sites-available/default
nginx -t
systemctl reload nginx
# A successful reload returns before old workers stop accepting requests. Wait
# for the exact candidate manifest rather than accepting an old SPA's HTTP 200.
ready=0
for attempt in {1..10}; do
    if curl --fail --silent --max-time 5 http://127.0.0.1/release.json -o "/tmp/jide-$release.probe" && cmp -s "/tmp/jide-$release.probe" "$release_dir/release.json"; then
        ready=1
        break
    fi
    sleep 1
done
test "$ready" = 1
curl --fail --silent --show-error --retry 3 --max-time 10 http://127.0.0.1/healthz
curl --fail --silent --show-error --max-time 10 http://127.0.0.1/api/feedback/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1/ -o /dev/null
systemctl enable jide-feedback
trap - ERR
rm -f "/tmp/jide-$release.tar.gz" "/tmp/jide-$release.nginx" "/tmp/jide-$release.feedback.py" "/tmp/jide-$release.service" "/tmp/jide-$release.probe"
printf '\nRelease: %s\nPrevious: %s\nConfig backup: %s/nginx.conf\n' "$release_dir" "$previous" "$backup_dir"
REMOTE
