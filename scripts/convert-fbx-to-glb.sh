#!/usr/bin/env bash
# convert-fbx-to-glb.sh — Batch convert FBX models to Draco-compressed GLB
#
# Usage:
#   ./scripts/convert-fbx-to-glb.sh [INPUT_DIR]
#
# INPUT_DIR defaults to "game/assets/models" (relative to repo root).
#
# Requirements:
#   - FBX2glTF  (https://github.com/facebookincubator/FBX2glTF)
#   - @gltf-transform/cli  (npm i -g @gltf-transform/cli)
#
# What it does:
#   1. Finds every .fbx file under INPUT_DIR (recursive).
#   2. Creates temporary local aliases for "Texture Main.png" so FBX2glTF can
#      preserve atlas textures inside GLB output.
#   3. Runs FBX2glTF --binary to produce an intermediate .glb.
#   4. Runs gltf-transform draco on the .glb for Draco compression.
#   5. Replaces the intermediate .glb with the compressed version.
#   6. Logs successes and failures; prints a summary at the end.
#
# Notes:
#   - Filenames with spaces are handled via proper quoting.
#   - The original .fbx files are NOT deleted by this script; delete them
#     separately after verifying the .glb output.
#   - Existing .glb files are overwritten without prompt.

set -euo pipefail

INPUT_DIR="${1:-game/assets/models}"
PASS=0
FAIL=0
FAILED_FILES=()

if ! command -v FBX2glTF &>/dev/null; then
  echo "ERROR: FBX2glTF not found. Install from https://github.com/facebookincubator/FBX2glTF" >&2
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js." >&2
  exit 1
fi

pick_atlas_for_fbx() {
  local fbx_file="$1"
  local lower
  lower="$(printf '%s' "$fbx_file" | tr '[:upper:]' '[:lower:]')"
  if [[ "$lower" == *"/ships/"* || "$lower" == *"/ships-palmov/"* || "$lower" == *"/vehicles/"* ]]; then
    printf '%s' "assets/textures/ships.png"
  else
    printf '%s' "assets/textures/locations.png"
  fi
}

create_texture_aliases() {
  local fbx_file="$1"
  local dir atlas created=()
  dir="$(dirname "$fbx_file")"
  atlas="$(pick_atlas_for_fbx "$fbx_file")"

  # FBX files often reference one of these literal names.
  local alias_paths=(
    "$dir/Texture Main.png"
    "$dir/texture main.png"
  )

  for alias_path in "${alias_paths[@]}"; do
    if [[ ! -e "$alias_path" ]]; then
      cp "$atlas" "$alias_path"
      created+=("$alias_path")
    fi
  done

  printf '%s\n' "${created[@]:-}"
}

cleanup_texture_aliases() {
  local alias_path
  for alias_path in "$@"; do
    [[ -n "$alias_path" ]] && rm -f "$alias_path"
  done
}

echo "Converting FBX files in: $INPUT_DIR"
echo ""

while IFS= read -r -d '' fbx_file; do
  dir="$(dirname "$fbx_file")"
  base="$(basename "$fbx_file" .fbx)"
  glb_out="${dir}/${base}.glb"
  tmp_out="${dir}/${base}_tmp.glb"

  echo -n "  $fbx_file ... "

  mapfile -t created_aliases < <(create_texture_aliases "$fbx_file")

  # Step 1: FBX → GLB (intermediate, no compression yet)
  if ! FBX2glTF --binary --output "$tmp_out" "$fbx_file" &>/dev/null; then
    echo "FAILED (FBX2glTF)"
    cleanup_texture_aliases "${created_aliases[@]}"
    FAIL=$((FAIL + 1))
    FAILED_FILES+=("$fbx_file")
    continue
  fi

  # Step 2: Apply Draco compression
  if ! npx --yes @gltf-transform/cli draco "$tmp_out" "$glb_out" &>/dev/null; then
    echo "FAILED (draco)"
    rm -f "$tmp_out"
    cleanup_texture_aliases "${created_aliases[@]}"
    FAIL=$((FAIL + 1))
    FAILED_FILES+=("$fbx_file")
    continue
  fi

  rm -f "$tmp_out"
  cleanup_texture_aliases "${created_aliases[@]}"

  orig_size=$(wc -c < "$fbx_file")
  new_size=$(wc -c < "$glb_out")
  pct=$(awk "BEGIN { printf \"%d\", 100 - ($new_size * 100 / $orig_size) }")
  echo "OK (${orig_size} → ${new_size} bytes, -${pct}%)"
  PASS=$((PASS + 1))

done < <(find "$INPUT_DIR" -iname "*.fbx" -print0 | sort -z)

echo ""
echo "=== Conversion complete ==="
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "Failed files:"
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

exit 0
