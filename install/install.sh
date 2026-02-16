#!/bin/sh

set -eu

REPO="${GITPREFLIGHT_GITHUB_REPO:-un/gitpreflight}"
INSTALL_DIR="${GITPREFLIGHT_INSTALL_DIR:-${HOME}/.local/bin}"
TELEMETRY_BASE_URL="${GITPREFLIGHT_TELEMETRY_BASE_URL:-${GITPREFLIGHT_API_BASE_URL:-https://gitpreflight.ai}}"

say() { printf '%s\n' "$*"; }
die() { printf '%s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

need_cmd curl
need_cmd uname
need_cmd chmod
need_cmd mkdir

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="darwin" ;;
  Linux) PLATFORM="linux" ;;
  *) die "Unsupported OS: $OS (supported: macOS, Linux)" ;;
esac

case "$ARCH" in
  x86_64|amd64) CPU="x64" ;;
  arm64|aarch64) CPU="arm64" ;;
  *) die "Unsupported arch: $ARCH (supported: x64, arm64)" ;;
esac

VERSION="${GITPREFLIGHT_INSTALL_VERSION:-}"
if [ -z "$VERSION" ]; then
  # Resolve latest tag via GitHub redirect.
  VERSION="$(curl -fsSLI "https://github.com/${REPO}/releases/latest" \
    | tr -d '\r' \
    | awk -F'/' 'tolower($1) ~ /^location:$/ {print $NF; exit 0}')"
fi

if [ -z "$VERSION" ]; then
  die "Failed to resolve latest GitPreflight version (set GITPREFLIGHT_INSTALL_VERSION to pin)"
fi

ASSET="gitpreflight-${VERSION}-${PLATFORM}-${CPU}"
BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
ASSET_URL="${BASE_URL}/${ASSET}"
CHECKSUMS_URL="${BASE_URL}/checksums.txt"

TMP_DIR="${TMPDIR:-/tmp}"
TMP_BIN="${TMP_DIR}/gitpreflight.$$"
TMP_SUMS="${TMP_DIR}/gitpreflight-checksums.$$"

cleanup() {
  rm -f "$TMP_BIN" "$TMP_SUMS" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

say "GitPreflight: downloading ${ASSET}..."
curl -fsSL "$ASSET_URL" -o "$TMP_BIN"
curl -fsSL "$CHECKSUMS_URL" -o "$TMP_SUMS"

EXPECTED="$(awk -v name="$ASSET" '$2==name {print $1; exit 0}' "$TMP_SUMS")"
if [ -z "$EXPECTED" ]; then
  die "Missing checksum for ${ASSET} in checksums.txt"
fi

ACTUAL=""
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$TMP_BIN" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 "$TMP_BIN" | awk '{print $1}')"
else
  die "Missing sha256 tool (need sha256sum or shasum)"
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  die "Checksum mismatch for ${ASSET}"
fi

mkdir -p "$INSTALL_DIR"
chmod 755 "$TMP_BIN"

DEST="${INSTALL_DIR}/gitpreflight"
mv "$TMP_BIN" "$DEST"
chmod 755 "$DEST"

say "GitPreflight installed to: ${DEST}"

TELEMETRY_FLAG="$(printf '%s' "${GITPREFLIGHT_ANON_TELEMETRY:-1}" | tr '[:upper:]' '[:lower:]')"
TELEMETRY_DISABLE_FLAG="$(printf '%s' "${GITPREFLIGHT_DISABLE_ANON_TELEMETRY:-0}" | tr '[:upper:]' '[:lower:]')"
if [ "$TELEMETRY_DISABLE_FLAG" != "1" ] && [ "$TELEMETRY_DISABLE_FLAG" != "true" ] && [ "$TELEMETRY_DISABLE_FLAG" != "yes" ] \
  && [ "$TELEMETRY_FLAG" != "0" ] && [ "$TELEMETRY_FLAG" != "false" ] && [ "$TELEMETRY_FLAG" != "no" ]; then
  CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/gitpreflight"
  INSTALL_ID_FILE="${CONFIG_DIR}/install-id"
  INSTALL_ID=""

  if [ -f "$INSTALL_ID_FILE" ]; then
    INSTALL_ID="$(tr -d '\r\n' < "$INSTALL_ID_FILE")"
  fi

  if [ ${#INSTALL_ID} -lt 16 ] || [ ${#INSTALL_ID} -gt 128 ]; then
    if command -v uuidgen >/dev/null 2>&1; then
      INSTALL_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
    else
      INSTALL_ID="$(date +%s)-$$-$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')"
    fi
    mkdir -p "$CONFIG_DIR"
    printf '%s\n' "$INSTALL_ID" > "$INSTALL_ID_FILE"
    chmod 600 "$INSTALL_ID_FILE" 2>/dev/null || true
  fi

  TELEMETRY_URL="$(printf '%s' "$TELEMETRY_BASE_URL" | sed 's:/*$::')/api/v1/analytics/install"
  curl -fsSL -X POST "$TELEMETRY_URL" \
    -H 'content-type: application/json' \
    --data "{\"installId\":\"$INSTALL_ID\",\"channel\":\"curl_install\",\"cliVersion\":\"$VERSION\",\"platform\":\"$PLATFORM\",\"arch\":\"$CPU\"}" \
    >/dev/null 2>&1 || true
fi

say ""
say "Next:"
say "  gitpreflight --help"
say ""
say "If 'gitpreflight' is not found, add this to your shell profile:"
say "  export PATH=\"${INSTALL_DIR}:\$PATH\""
