#!/usr/bin/env bash
# Uninstall pipelog: binary, config directory, and zsh shell-integration block in ~/.zshrc
set -euo pipefail

BIN_NAME="pipelog"
INSTALL_DIR="${PIPELOG_INSTALL_DIR:-/usr/local/bin}"
ASSUME_YES=false
REMOVE_ZSHRC_BLOCK=true

if [[ "${PIPELOG_UNINSTALL_KEEP_ZSHRC:-}" == "1" ]]; then
  REMOVE_ZSHRC_BLOCK=false
fi

log() { printf '%s\n' "$*"; }
err() { printf 'Error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: uninstall.sh [options]

Removes:
  - pipelog binary (known install locations + current PATH)
  - config directory (XDG, ~/.config, macOS Application Support)
  - the pipelog zsh integration block in ~/.zshrc (if present)

Options:
  -y, --yes     Do not prompt for confirmation
  -h, --help    Show this help

Environment:
  PIPELOG_INSTALL_DIR   Same as install default (/usr/local/bin)
  PIPELOG_UNINSTALL_KEEP_ZSHRC=1  Do not edit ~/.zshrc

Examples:
  bash scripts/uninstall.sh
  bash scripts/uninstall.sh --yes
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1 (use --help)" ;;
  esac
done

declare -a BIN_CANDIDATES=(
  "${INSTALL_DIR}/${BIN_NAME}"
  "/usr/local/bin/${BIN_NAME}"
  "/opt/homebrew/bin/${BIN_NAME}"
)

if path_bin="$(command -v "${BIN_NAME}" 2>/dev/null)"; then
  BIN_CANDIDATES+=("$path_bin")
fi

declare -a CONFIG_DIRS=(
  "${XDG_CONFIG_HOME:-${HOME}/.config}/pipelog"
  "${HOME}/.config/pipelog"
  "${HOME}/Library/Application Support/pipelog"
)

remove_zshrc_block() {
  local zshrc="${HOME}/.zshrc"
  [[ -f "$zshrc" ]] || return 0
  command -v python3 >/dev/null 2>&1 || {
    log "python3 not found; skip ~/.zshrc edit (remove pipelog block manually)."
    return 0
  }

  python3 - "$zshrc" <<'PY'
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8", errors="replace")
lines = text.splitlines(keepends=True)
out = []
i = 0
changed = False
while i < len(lines):
    line = lines[i]
    if line.lstrip().startswith("# pipelog shell integration"):
        changed = True
        j = i + 1
        while j < len(lines) and "pipelog() {" not in lines[j]:
            j += 1
        if j >= len(lines):
            i += 1
            continue
        brace = 0
        k = j
        while k < len(lines):
            brace += lines[k].count("{") - lines[k].count("}")
            k += 1
            if brace == 0:
                break
        i = k
        while i < len(lines) and lines[i].strip() == "":
            i += 1
        continue
    out.append(line)
    i += 1
if changed:
    path.write_text("".join(out), encoding="utf-8")
PY
  log "✓ Removed pipelog block from ~/.zshrc (if it was present)."
}

main() {
  log "Pipelog uninstall"
  log ""

  if [[ "$ASSUME_YES" != true ]]; then
    read -r -p "Remove pipelog binary, config, and zsh integration from ~/.zshrc? [y/N] " ans
    case "${ans:-}" in
      y|Y|yes|YES) ;;
      *) log "Aborted."; exit 0 ;;
    esac
  fi

  # Binaries (same inode via -ef, works on bash 3.2 / macOS)
  declare -a TO_REMOVE=()
  for p in "${BIN_CANDIDATES[@]}"; do
    [[ -n "$p" && -e "$p" ]] || continue
    dup=0
    # With `set -u`, expanding an empty array `${TO_REMOVE[@]}` errors on bash 4.4+.
    if [[ ${#TO_REMOVE[@]} -gt 0 ]]; then
      for q in "${TO_REMOVE[@]}"; do
        if [[ "$p" -ef "$q" ]]; then dup=1; break; fi
      done
    fi
    [[ "$dup" -eq 0 ]] && TO_REMOVE+=("$p")
  done

  if [[ ${#TO_REMOVE[@]} -gt 0 ]]; then
    for p in "${TO_REMOVE[@]}"; do
      if [[ ! -w "$(dirname "$p")" ]]; then
        log "Removing (sudo): $p"
        sudo rm -f "$p"
      else
        log "Removing: $p"
        rm -f "$p"
      fi
    done
  else
    log "No pipelog binary found in common locations (already removed?)."
  fi

  for d in "${CONFIG_DIRS[@]}"; do
    if [[ -d "$d" ]]; then
      log "Removing config: $d"
      rm -rf "$d"
    fi
  done

  if [[ "$REMOVE_ZSHRC_BLOCK" == true ]]; then
    remove_zshrc_block
  else
    log "Skipping ~/.zshrc (PIPELOG_UNINSTALL_KEEP_ZSHRC=1)."
  fi

  log ""
  log "Done. Open a new terminal (or run: exec zsh) so any pipelog shell function is gone."
}

main "$@"
