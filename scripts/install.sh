#!/usr/bin/env bash
set -euo pipefail

REPO="${PIPELOG_REPO:-DaltonVector-FOSS/pipelog}"
VERSION="${PIPELOG_VERSION:-latest}"
INSTALL_DIR="${PIPELOG_INSTALL_DIR:-/usr/local/bin}"
DOWNLOAD_URL="${PIPELOG_DOWNLOAD_URL:-}"
TMP_DIR="${TMPDIR:-/tmp}"
BIN_NAME="pipelog"

log() {
  printf '%s\n' "$*"
}

err() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "Missing required dependency: $1"
}

detect_os() {
  os="$(uname -s 2>/dev/null || true)"
  case "$os" in
    Darwin) printf '%s' "apple-darwin" ;;
    Linux) printf '%s' "unknown-linux-gnu" ;;
    *) err "Unsupported operating system: ${os:-unknown}. Supported: macOS and Linux." ;;
  esac
}

detect_arch() {
  arch="$(uname -m 2>/dev/null || true)"
  case "$arch" in
    x86_64|amd64) printf '%s' "x86_64" ;;
    arm64|aarch64) printf '%s' "aarch64" ;;
    *) err "Unsupported architecture: ${arch:-unknown}. Supported: x86_64 and arm64." ;;
  esac
}

resolve_version() {
  if [ "$VERSION" = "latest" ]; then
    printf '%s' "latest"
  else
    case "$VERSION" in
      v*) printf '%s' "$VERSION" ;;
      *) printf 'v%s' "$VERSION" ;;
    esac
  fi
}

download_url() {
  target="$1"
  version_tag="$(resolve_version)"

  if [ "$version_tag" = "latest" ]; then
    printf '%s' "https://github.com/${REPO}/releases/latest/download/${BIN_NAME}-${target}.tar.gz"
  else
    printf '%s' "https://github.com/${REPO}/releases/download/${version_tag}/${BIN_NAME}-${target}.tar.gz"
  fi
}

extract_binary() {
  archive_path="$1"
  out_dir="$2"

  tar -xzf "$archive_path" -C "$out_dir"

  for candidate in "${out_dir}/${BIN_NAME}" "${out_dir}"/*/"${BIN_NAME}"; do
    if [ -f "$candidate" ]; then
      printf '%s' "$candidate"
      return
    fi
  done

  err "Archive extracted, but '${BIN_NAME}' was not found."
}

install_binary() {
  src="$1"
  dst="${INSTALL_DIR}/${BIN_NAME}"
  chmod +x "$src"

  if [ -w "$INSTALL_DIR" ]; then
    cp "$src" "$dst"
  else
    need_cmd sudo
    sudo mkdir -p "$INSTALL_DIR"
    sudo cp "$src" "$dst"
  fi
}

main() {
  need_cmd curl
  need_cmd tar
  need_cmd uname
  need_cmd mktemp
  os="$(detect_os)"
  arch="$(detect_arch)"
  target="${arch}-${os}"
  if [ -n "$DOWNLOAD_URL" ]; then
    url="$DOWNLOAD_URL"
  else
    url="$(download_url "$target")"
  fi

  work_dir="$(mktemp -d "${TMP_DIR%/}/pipelog-install.XXXXXX")"
  archive="${work_dir}/${BIN_NAME}.tar.gz"
  cleanup() {
    rm -rf "$work_dir"
  }
  trap cleanup EXIT INT TERM

  log "Downloading ${BIN_NAME} (${target}) from GitHub Releases..."
  curl -fsSL "$url" -o "$archive" || err "Failed to download release asset from: $url"
  [ -s "$archive" ] || err "Downloaded archive is empty."

  extracted_bin="$(extract_binary "$archive" "$work_dir")"
  install_binary "$extracted_bin"

  log "Installed ${BIN_NAME} to ${INSTALL_DIR}/${BIN_NAME}"
  log ""
  log "Verify install:"
  log "  ${BIN_NAME} --version"
  log ""
  log "Run once (zsh — captures command in pipelines):"
  log "pipelog init zsh >> ~/.zshrc"
  log "source ~/.zshrc"
  log ""
  log "Then log in:"
  log "  ${BIN_NAME} auth login"
}

main "$@"
