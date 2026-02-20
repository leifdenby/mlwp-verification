#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LINKS_FILE="$ROOT_DIR/work/report_links.tsv"
REPORTS_DIR="$ROOT_DIR/reports"
STATUS_FILE="$ROOT_DIR/work/download_status.tsv"

mkdir -p "$REPORTS_DIR"
printf '' > "$STATUS_FILE"

while IFS=$'\t' read -r folder url; do
  [ -z "${folder:-}" ] && continue
  dir="$REPORTS_DIR/$folder"
  mkdir -p "$dir"

  printf '%s\n' "$url" > "$dir/source_url.txt"
  rm -f "$dir"/download.bin "$dir"/wget.log

  if wget --no-check-certificate --content-disposition -O "$dir/download.bin" "$url" >"$dir/wget.log" 2>&1; then
    status="ok"
  else
    status="failed"
  fi

  size="0"
  if [ -f "$dir/download.bin" ]; then
    size="$(wc -c < "$dir/download.bin" | tr -d ' ')"
  fi

  printf '%s\t%s\t%s\t%s\n' "$folder" "$status" "$size" "$url" >> "$STATUS_FILE"
done < "$LINKS_FILE"
