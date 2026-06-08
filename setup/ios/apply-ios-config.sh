#!/usr/bin/env bash
# apply-ios-config.sh
# Run AFTER: npm install && npx cap add ios && npx cap sync
# Usage: bash setup/ios/apply-ios-config.sh

set -e
PROJ_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS_APP="$PROJ_ROOT/ios/App/App"

echo "📱 Applying iOS HealthKit configuration..."

# ── 1. Verify ios directory exists ───────────────────────────────────────────
if [ ! -d "$PROJ_ROOT/ios" ]; then
  echo "❌ ios/ not found. Run: npx cap add ios"
  exit 1
fi

# ── 2. Copy PrivacyInfo.xcprivacy ─────────────────────────────────────────────
cp "$PROJ_ROOT/setup/ios/PrivacyInfo.xcprivacy" "$IOS_APP/PrivacyInfo.xcprivacy"
echo "  ✅ PrivacyInfo.xcprivacy copied"

# ── 3. Copy Entitlements ──────────────────────────────────────────────────────
# Capacitor creates App.entitlements automatically when you enable HealthKit
# in Xcode. We overwrite it with our complete version.
cp "$PROJ_ROOT/setup/ios/App.entitlements" "$IOS_APP/App.entitlements"
echo "  ✅ App.entitlements copied"

# ── 4. Patch Info.plist ───────────────────────────────────────────────────────
PLIST="$IOS_APP/Info.plist"
if ! grep -q "NSHealthShareUsageDescription" "$PLIST"; then
  # Insert before the closing </dict></plist>
  ADDITIONS=$(cat "$PROJ_ROOT/setup/ios/Info.plist.additions.xml" | \
    grep -v '<?xml\|<!--\|-->' | \
    sed 's|<dict>||' | sed 's|</dict>||' | \
    grep -v '^[[:space:]]*$')

  # Use Python (available on macOS by default) for safe plist editing
  python3 - <<PYEOF
import plistlib, sys

with open("$PLIST", "rb") as f:
    pl = plistlib.load(f)

additions = {
    "NSHealthShareUsageDescription":
        "يستخدم دقيق Apple Health لمزامنة تمارينك، وزنك، وسعراتك.",
    "NSHealthUpdateUsageDescription":
        "يحتاج دقيق حفظ جلسات التمرين والوزن في Apple Health.",
    "BGTaskSchedulerPermittedIdentifiers":
        ["com.daqeeq.healthsync.runner"],
    "UIBackgroundModes":
        list(set(pl.get("UIBackgroundModes", []) + ["fetch", "processing"])),
}
pl.update(additions)

with open("$PLIST", "wb") as f:
    plistlib.dump(pl, f, fmt=plistlib.FMT_XML)

print("  ✅ Info.plist patched")
PYEOF
else
  echo "  ℹ️  Info.plist already has HealthKit keys — skipped"
fi

# ── 5. Remind about Xcode manual steps ───────────────────────────────────────
cat <<REMINDER

⚠️  MANUAL STEPS REQUIRED IN XCODE:
  1. Open: npx cap open ios
  2. Select App target → Signing & Capabilities
  3. Click "+" → add "HealthKit" capability
     (This links the HealthKit framework and signs the entitlement)
  4. Check "Background Delivery" under HealthKit options
  5. Select App target → Build Phases → Link Binary With Libraries
     → Verify "HealthKit.framework" is listed (Status: Optional)
  6. Product → Clean Build Folder (⇧⌘K) then Build (⌘B)

REMINDER

echo "✅ iOS configuration applied."
