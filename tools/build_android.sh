#!/usr/bin/env bash
# Build an installable, test-signed universal ARM APK. Keep the keystore private
# and reuse it for subsequent test updates; it is never part of the repository.
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
godot_bin="${GODOT_BIN:-godot}"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to your Android SDK directory}"
: "${JAVA_HOME:?Set JAVA_HOME to your Java installation}"
build_tools="$ANDROID_SDK_ROOT/build-tools/36.0.0"
for tool in "$JAVA_HOME/bin/java" "$JAVA_HOME/bin/keytool" "$build_tools/apksigner" "$build_tools/aapt" "$build_tools/zipalign" "$ANDROID_SDK_ROOT/platform-tools/adb"; do
    test -x "$tool" || { printf 'Missing build tool: %s\n' "$tool" >&2; exit 1; }
done
godot_version="$("$godot_bin" --version)"
[[ "$godot_version" == 4.7.2.* ]] || { printf 'Expected Godot 4.7.2, got %s\n' "$godot_version" >&2; exit 1; }
output="${1:-$project_root/dist/CrossroadsCommand-0.9.1-test.2.apk}"
mkdir -p -- "$(dirname -- "$output")"
output="$(realpath -- "$output")"
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="${ANDROID_TEST_KEYSTORE:-${XDG_DATA_HOME:-$HOME/.local/share}/wartable-signing/android-test.keystore}"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="${ANDROID_TEST_KEY_ALIAS:-wartabletest}"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="${ANDROID_TEST_KEYSTORE_PASSWORD:-android}"
if [[ ! -f "$GODOT_ANDROID_KEYSTORE_RELEASE_PATH" ]]; then
    mkdir -p -- "$(dirname -- "$GODOT_ANDROID_KEYSTORE_RELEASE_PATH")"
    "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$GODOT_ANDROID_KEYSTORE_RELEASE_PATH" \
        -storetype PKCS12 -alias "$GODOT_ANDROID_KEYSTORE_RELEASE_USER" \
        -storepass:env GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD \
        -keypass:env GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Crossroads Command Test, O=WarTable, C=US"
    chmod 600 "$GODOT_ANDROID_KEYSTORE_RELEASE_PATH"
fi
build_config="$(mktemp -d "${TMPDIR:-/tmp}/wartable-android.XXXXXX")"
trap 'rm -rf -- "$build_config"' EXIT
export XDG_CONFIG_HOME="$build_config/config"
python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ['XDG_CONFIG_HOME']) / 'godot/editor_settings-4.7.tres'
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text('[gd_resource type="EditorSettings" format=3]\n\n[resource]\n'
    + 'export/android/java_sdk_path = ' + json.dumps(os.environ['JAVA_HOME']) + '\n'
    + 'export/android/android_sdk_path = ' + json.dumps(os.environ['ANDROID_SDK_ROOT']) + '\n')
PY
"$godot_bin" --headless --editor --path "$project_root" --import
"$godot_bin" --headless --path "$project_root" --export-release "Android Test" "$output"
"$build_tools/apksigner" verify --verbose "$output"
"$build_tools/zipalign" -c -P 16 4 "$output"
"$build_tools/aapt" dump badging "$output" > "$output.manifest.txt"
python3 - "$output" "$project_root" "$godot_version" <<'PY'
import hashlib, json, subprocess, sys
from pathlib import Path
apk, root = Path(sys.argv[1]), Path(sys.argv[2])
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
Path(str(apk) + '.sha256').write_text(digest + '  ' + apk.name + '\n')
metadata = {
    'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'source_dirty': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()),
    'godot_version': sys.argv[3], 'apk': apk.name, 'sha256': digest, 'bytes': apk.stat().st_size,
    'package': 'org.crossroadscommand.cloudtest', 'architectures': ['arm64-v8a', 'armeabi-v7a'],
}
Path(str(apk) + '.build-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Built', apk.name, '-', round(apk.stat().st_size / 1048576, 1), 'MiB')
PY
