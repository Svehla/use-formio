#!/usr/bin/env bash
#
# Runs the whole test suite + the typecheck against every supported React version.
#
# The peerDependency of the library is `react >= 18`, so a failure of any row below is a real
# compatibility bug. Each row gets its own pristine copy of the project in $TMPDIR (node_modules
# and example/ are not copied), installs the pinned react / react-dom (+ the matching @types) and
# then runs `vitest run` and `tsc --noEmit`.
#
# usage: npm run test:react-matrix
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${TMPDIR:-/tmp}"
WORKDIR="${TMP%/}/use-formio-react-matrix"
# the default ~/.npm/_cacache is not always writable (sandboxes / CI images)
export npm_config_cache="${TMP%/}/npm-cache"
export CI=1

# "<react version>:<@types/react version>:<label>"
MATRIX=(
  "18.2:18:react@18.2"
  "18.3:18:react@18.3"
  "19:19:react@19 (latest)"
)

mkdir -p "$WORKDIR" "$npm_config_cache"

labels=()
install_results=()
vitest_results=()
tsc_results=()
overall=0

log_tail() {
  echo "----- last 40 lines of $1 -----"
  tail -40 "$1"
  echo "-------------------------------"
}

for row in "${MATRIX[@]}"; do
  react_version="${row%%:*}"
  rest="${row#*:}"
  types_version="${rest%%:*}"
  label="${rest#*:}"

  dir="$WORKDIR/react-$react_version"
  echo ""
  echo "=============================================================="
  echo "  $label  ->  $dir"
  echo "=============================================================="

  rm -rf "$dir"
  mkdir -p "$dir"
  rsync -a \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "example" \
    --exclude "dist" \
    --exclude "coverage" \
    --exclude "bench-results" \
    "$ROOT/" "$dir/"

  # husky's `prepare` lifecycle script needs a git repository, the copy is not one
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
    delete pkg.scripts.prepare;
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
  ' "$dir/package.json"

  install_log="$dir/matrix-install.log"
  vitest_log="$dir/matrix-vitest.log"
  tsc_log="$dir/matrix-tsc.log"

  install_status="ok"
  vitest_status="skipped"
  tsc_status="skipped"

  if (cd "$dir" && npm i --no-audit --no-fund) > "$install_log" 2>&1 &&
    (cd "$dir" && npm i --no-audit --no-fund --no-save \
      "react@$react_version" "react-dom@$react_version" \
      "@types/react@$types_version" "@types/react-dom@$types_version") >> "$install_log" 2>&1; then
    resolved="$(cd "$dir" && node -p 'require("react/package.json").version' 2>/dev/null)"
    echo "installed react: ${resolved:-unknown}"
    install_status="ok (${resolved:-unknown})"

    echo "--- vitest run ---"
    if (cd "$dir" && npx vitest run) > "$vitest_log" 2>&1; then
      vitest_status="pass"
      tail -6 "$vitest_log"
    else
      vitest_status="FAIL"
      overall=1
      log_tail "$vitest_log"
    fi

    echo "--- tsc --noEmit ---"
    if (cd "$dir" && npx tsc --noEmit -p tsconfig.json) > "$tsc_log" 2>&1; then
      tsc_status="pass"
      echo "no type errors"
    else
      tsc_status="FAIL"
      overall=1
      log_tail "$tsc_log"
    fi
  else
    install_status="FAIL"
    overall=1
    log_tail "$install_log"
  fi

  labels+=("$label")
  install_results+=("$install_status")
  vitest_results+=("$vitest_status")
  tsc_results+=("$tsc_status")
done

echo ""
echo "=============================================================="
echo "  React compatibility matrix"
echo "=============================================================="
printf "%-22s %-18s %-10s %-10s\n" "target" "install" "vitest" "tsc"
printf "%-22s %-18s %-10s %-10s\n" "----------------------" "------------------" "----------" "----------"
for index in "${!labels[@]}"; do
  printf "%-22s %-18s %-10s %-10s\n" \
    "${labels[$index]}" "${install_results[$index]}" "${vitest_results[$index]}" "${tsc_results[$index]}"
done
echo ""

if [ "$overall" -ne 0 ]; then
  echo "react matrix: FAILED (logs in $WORKDIR/react-*/matrix-*.log)"
else
  echo "react matrix: all targets green"
fi
exit "$overall"
