#!/usr/bin/env bash
# Print the Subresource Integrity (sha384) value for every external CDN URL
# in src/clj/bluegenes/index.clj, ready to paste next to that URL.
#
# Usage: script/cdn-sri.sh [URL...]
# With no arguments, the CDN URLs are read from src/clj/bluegenes/index.clj.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
index="$root/src/clj/bluegenes/index.clj"

if [ "$#" -gt 0 ]; then
  urls=("$@")
else
  mapfile -t urls < <(grep -oE '"https://(cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|unpkg\.com)/[^"]+"' "$index" | tr -d '"' | sort -u)
fi

for url in "${urls[@]}"; do
  hash="$(curl -fsSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
  printf '%s\n  integrity="sha384-%s"\n' "$url" "$hash"
done
