#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"

if [[ "${VERCEL:-}" == "1" ]]; then
  echo "Running Next.js build for Vercel..."
  exec "${project_root}/node_modules/.bin/next" build
fi

exec "${script_dir}/build-verified.sh" "$@"
