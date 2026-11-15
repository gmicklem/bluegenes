#!/usr/bin/env bash
# Check the contents of a BlueGenes jar built by `clojure -T:build uber` or
# `clojure -T:build jar|install`. Mirrors the jar-check and libjar steps of the
# local gate (intermine-planning/scripts/gate-bluegenes.sh).
#
# Usage: jar-check.sh uber <target/bluegenes.jar>
#        jar-check.sh lib  <target/bluegenes-<version>.jar> <version>
set -uo pipefail
kind=${1:-}; jar=${2:-}; version=${3:-}
{ [ -f "$jar" ] && { [ "$kind" = uber ] || { [ "$kind" = lib ] && [ -n "$version" ]; }; }; } || {
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

list=$(unzip -Z1 "$jar")
# here-strings, not `printf | grep -q`: grep -q exits early, and under pipefail
# the resulting SIGPIPE in printf would make a present entry look missing
has() { grep -qx -- "$1" <<<"$list"; }
prob=""
hash=$(unzip -p "$jar" public/js/compiled/manifest.edn 2>/dev/null |
  grep -oE ':output-name "app\.[^"]*\.js"' | sed -E 's/.*app\.(.*)\.js"/\1/')
[ -n "$hash" ] || prob="$prob no manifest.edn with an app hash;"
has bluegenes/core.class || prob="$prob no bluegenes/core.class;"
has "public/js/compiled/app.$hash.js" || prob="$prob no app.$hash.js;"
has "public/css/site-$hash.css" || prob="$prob no site-$hash.css;"

if [ "$kind" = uber ]; then
  has org/eclipse/jetty/util/Attributes.class || prob="$prob no jetty-util classes;"
  has "public/css/im-tables-$hash.css" || prob="$prob no im-tables-$hash.css;"
  has config.edn || prob="$prob no config.edn;"
else
  has bluegenes/routes.clj || prob="$prob no server sources;"
  # a library jar carries no dependency classes
  grep -qE '^(org|clojure|ring|compojure|bluegenes_tool_store)/' <<<"$list" &&
    prob="$prob dependency classes in the library jar;"
  pom=$(unzip -p "$jar" META-INF/maven/org.intermine/bluegenes/pom.xml 2>/dev/null)
  grep -q '<groupId>org.intermine</groupId>' <<<"$pom" || prob="$prob pom groupId;"
  grep -q '<artifactId>bluegenes</artifactId>' <<<"$pom" || prob="$prob pom artifactId;"
  grep -q "<version>$version</version>" <<<"$pom" || prob="$prob pom version != $version;"
  # the front end is compiled into the jar: consumers must not get its build tools
  grep -qE '<artifactId>(clojurescript|shadow-cljs|re-frame|reagent|im-tables)</artifactId>' <<<"$pom" &&
    prob="$prob pom lists front-end deps;"
fi

if [ -n "$prob" ]; then echo "JAR CHECK FAILED ($kind, $jar):$prob"; exit 1; fi
echo "JAR CHECK OK ($kind, $jar): hash $hash, $(du -h "$jar" | cut -f1)"
