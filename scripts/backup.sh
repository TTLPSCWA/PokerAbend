#!/usr/bin/env bash
# Sichert das Daten-Volume des Spieleabends als .tar.gz.
# Aufruf und optionale Offsite-Ziele: docs/betrieb.md, Abschnitt 7.
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/spieleabend}"
KEEP_DAYS="${KEEP_DAYS:-14}"
VOLUME="${VOLUME:-}"

fail() {
  echo "$(date '+%F %T') FEHLER: $*" >&2
  exit 1
}

[[ "$KEEP_DAYS" =~ ^[0-9]{1,5}$ ]] || fail 'KEEP_DAYS muss eine nichtnegative Tageszahl sein.'
if [ -z "$VOLUME" ]; then
  names="$(docker volume ls --format '{{.Name}}')" || fail 'Docker-Volumes konnten nicht gelesen werden.'
  mapfile -t candidates < <(printf '%s\n' "$names" | grep -E '(^|_)poker-data$' || true)
  [ "${#candidates[@]}" -eq 1 ] || fail 'Genau ein passendes Daten-Volume erwartet. Das gewünschte Volume mit VOLUME angeben.'
  VOLUME="${candidates[0]}"
fi
[[ "$VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || fail 'Ungültiger Docker-Volume-Name.'
docker volume inspect "$VOLUME" >/dev/null 2>&1 || fail 'Das angegebene Docker-Volume fehlt.'

[ ! -L "$BACKUP_DIR" ] || fail 'Das Sicherungsverzeichnis darf kein symbolischer Link sein.'
mkdir -p -- "$BACKUP_DIR"
if [[ "${OSTYPE:-}" != msys* ]]; then
  mode="$(stat -c '%a' -- "$BACKUP_DIR")"
  if [ ! -O "$BACKUP_DIR" ] || (( (8#$mode & 0022) != 0 )); then
    fail 'Das Sicherungsverzeichnis muss dem ausführenden Konto gehören und darf für andere nicht beschreibbar sein.'
  fi
fi

file="spieleabend-$(date '+%F_%H%M').tar.gz"
target="$BACKUP_DIR/$file"
partial="$(mktemp -- "$BACKUP_DIR/.spieleabend-partial.XXXXXXXX")"
trap 'rm -f -- "$partial"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker run --rm --network none --mount "type=volume,src=$VOLUME,dst=/data,readonly" \
    alpine:3 tar czf - -C /data . > "$partial" 2>/dev/null; then
  fail 'Der Sicherungscontainer konnte das Datenarchiv nicht erstellen.'
fi
if ! tar tzf "$partial" 2>/dev/null | awk '$0 != "." && $0 != "./" { found = 1 } END { if (!found) exit 1 }'; then
  fail 'Das erzeugte Datenarchiv ist leer oder beschädigt.'
fi

# Publish only the complete archive and never replace an existing backup.
ln -T -- "$partial" "$target" 2>/dev/null || fail 'Die fertige Sicherung konnte nicht exklusiv veröffentlicht werden.'
rm -f -- "$partial"
echo "$(date '+%F %T') Gesichert: $file ($(du -h "$target" | cut -f1))"

expired="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'spieleabend-????-??-??_????.tar.gz' -mtime +"$KEEP_DAYS" -printf '.' | wc -c)"
echo "$(date '+%F %T') Aufbewahrung: $expired Sicherung(en) älter als $KEEP_DAYS Tage zur manuellen Prüfung."

copy_failed=0
if [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  if rsync -a -- "$target" "$BACKUP_RSYNC_TARGET" >/dev/null 2>&1; then
    echo "$(date '+%F %T') Kopiert (rsync)."
  else
    echo "$(date '+%F %T') FEHLER: rsync-Kopie fehlgeschlagen. Die lokale Sicherung bleibt erhalten." >&2
    copy_failed=1
  fi
fi
if [ -n "${BACKUP_RCLONE_TARGET:-}" ]; then
  if rclone copy -- "$target" "$BACKUP_RCLONE_TARGET" >/dev/null 2>&1; then
    echo "$(date '+%F %T') Kopiert (rclone)."
  else
    echo "$(date '+%F %T') FEHLER: rclone-Kopie fehlgeschlagen. Die lokale Sicherung bleibt erhalten." >&2
    copy_failed=1
  fi
fi
exit "$copy_failed"
