#!/usr/bin/env bash
# Start BlueGenes with the given command and check that it serves what a
# browser needs. Mirrors the smoke-NN / libjar-run steps of the local gate
# (intermine-planning/scripts/gate-bluegenes.sh).
#
# Usage: smoke.sh <label> <jar> <java> [java args...]
#   <jar>   a BlueGenes jar (uber or library); only its manifest.edn is read, to
#           learn the asset hash the server must hand out
#   <java>  the java executable to start
#   Use absolute paths in the java args: the server runs from a temporary
#   directory (it writes ./tools into its working directory).
# Examples:
#   smoke.sh uber-21 target/bluegenes.jar "$JAVA_HOME/bin/java" -jar "$PWD/target/bluegenes.jar"
#   smoke.sh lib-17 target/bluegenes-1.5.0-SNAPSHOT.jar "$JAVA_HOME_17_X64/bin/java" -cp "$CP" bluegenes.core
#
# Checks: /version answers within 120 s; /, /version, /api/tools/all and the
# js and css files the page references all return 200; the hash in those file
# names and in serverVars.version (the client-state reset key) is the one in
# the jar's manifest.edn.
# Environment: SMOKE_PORT (default 5055), CI_LOG_DIR (default ci-logs; the
# server log goes there as smoke-<label>-server.log),
# BLUEGENES_DEFAULT_SERVICE_ROOT (default https://www.flymine.org/flymine; "/"
# fetches the default mine's markup, 3 s timeout, so it need not be reachable).
set -u   # no pipefail: failures are collected in $prob, and `grep | head -1` may SIGPIPE
[ $# -ge 4 ] || { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
label=$1; jar=$(realpath "$2"); javabin=$3; shift 3
port=${SMOKE_PORT:-5055}
mkdir -p "${CI_LOG_DIR:-ci-logs}"
log=$(cd "${CI_LOG_DIR:-ci-logs}" && pwd)/smoke-$label-server.log
base=http://localhost:$port

want=$(unzip -p "$jar" public/js/compiled/manifest.edn | grep -oE ':output-name "app\.[^"]*\.js"' | sed -E 's/.*app\.(.*)\.js"/\1/')
[ -n "$want" ] || { echo "SMOKE $label: no asset hash in $jar"; exit 1; }

dir=$(mktemp -d)
( cd "$dir" && SERVER_PORT=$port \
    BLUEGENES_DEFAULT_SERVICE_ROOT=${BLUEGENES_DEFAULT_SERVICE_ROOT:-https://www.flymine.org/flymine} \
    exec "$javabin" "$@" ) > "$log" 2>&1 &
pid=$!
cleanup() { kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; rm -rf "$dir"; }
trap cleanup EXIT

start=$(date +%s); up=0
for _ in $(seq 1 120); do
  curl -s -o /dev/null -m 2 "$base/version" && { up=1; break; }
  kill -0 "$pid" 2>/dev/null || break
  sleep 1
done
secs=$(( $(date +%s) - start ))
prob=""
[ $up -eq 1 ] || prob="$prob server did not come up;"

code() { curl -s -o /dev/null -m "${2:-10}" -w '%{http_code}' "$base$1"; }
html=$(curl -s -m 30 "$base/")
js=$(echo "$html" | grep -oE '/js/compiled/app[^"]*\.js' | head -1)
css=$(echo "$html" | grep -oE '/css/site[^"]*\.css' | head -1)
imcss=$(echo "$html" | grep -oE '/css/im-tables[^"]*\.css' | head -1)
ver=$(echo "$html" | grep -oE ':version \\"[^\\]*' | sed 's/.*"//')
for p in / /version /api/tools/all "$js" "$css" "$imcss"; do
  [ -n "$p" ] || { prob="$prob page does not reference js/css/im-tables css;"; continue; }
  c=$(code "$p" 30); [ "$c" = 200 ] || prob="$prob GET $p -> $c;"
done
[ "$js" = "/js/compiled/app.$want.js" ] || prob="$prob page js '$js' != app.$want.js;"
[ "$css" = "/css/site-$want.css" ] || prob="$prob page css '$css' != site-$want.css;"
[ "$imcss" = "/css/im-tables-$want.css" ] || prob="$prob page css '$imcss' != im-tables-$want.css;"
[ "$ver" = "$want" ] || prob="$prob serverVars version '$ver' != $want;"

if [ -n "$prob" ]; then
  echo "SMOKE $label FAILED:$prob"
  echo "--- tail of $log"; tail -n 40 "$log"
  exit 1
fi
echo "SMOKE $label OK: up in ${secs}s; / /version /api/tools/all $js $css $imcss all 200; serverVars version=$ver"
