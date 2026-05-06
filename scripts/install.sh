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

# Strip surrounding whitespace and a single leading "v" for comparison.
normalize_version() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  case "$v" in
    v*) v="${v#v}" ;;
  esac
  printf '%s' "$v"
}

# Final URL after redirects, e.g. .../releases/tag/v0.1.0
latest_release_tag_raw() {
  local final tag
  final="$(
    curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest"
  )" || err "Failed to resolve latest release for ${REPO}"
  tag="${final#*/releases/tag/}"
  if [ "$tag" = "$final" ]; then
    err "Could not parse release tag from URL: ${final}"
  fi
  printf '%s' "$tag"
}

desired_normalized() {
  local raw
  if [ "$VERSION" = "latest" ]; then
    raw="$(latest_release_tag_raw)"
  else
    raw="$(resolve_version)"
  fi
  normalize_version "$raw"
}

installed_version() {
  local bin="$1" out
  out="$("$bin" --version 2>/dev/null)" || err "Failed to read version from ${bin}"
  printf '%s' "$out" | awk 'NF { print $NF }'
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
  need_cmd awk

  os="$(detect_os)"
  arch="$(detect_arch)"
  target="${arch}-${os}"

  bin_path="${INSTALL_DIR}/${BIN_NAME}"

  if [ -n "$DOWNLOAD_URL" ]; then
    log "Installing ${BIN_NAME} (custom download URL; version check skipped)..."
  elif [ -x "$bin_path" ]; then
    d="$(desired_normalized)"
    c="$(normalize_version "$(installed_version "$bin_path")")"
    if [ "$c" = "$d" ]; then
      log "${BIN_NAME} is already installed and up to date (${c})."
      exit 0
    fi
    log "${BIN_NAME} is installed (${c}); updating to ${d}..."
  else
    log "Installing ${BIN_NAME}..."
  fi

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

  if [ -n "$DOWNLOAD_URL" ]; then
    log "Downloading ${BIN_NAME} (${target})..."
  else
    log "Downloading ${BIN_NAME} (${target}) from GitHub Releases..."
  fi
  curl -fsSL "$url" -o "$archive" || err "Failed to download release asset from: $url"
  [ -s "$archive" ] || err "Downloaded archive is empty."

  extracted_bin="$(extract_binary "$archive" "$work_dir")"
  install_binary "$extracted_bin"

  log "Installed ${BIN_NAME} to ${INSTALL_DIR}/${BIN_NAME}"
  log ""
  log "Verify install:"
  log "  ${BIN_NAME} --version"
  log ""
  log "Next:"
  log "  ${BIN_NAME} auth login"
}

main "$@"
