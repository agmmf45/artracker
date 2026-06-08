#!/usr/bin/env bash
# apply-android-config.sh
# Run AFTER: npm install && npx cap add android && npx cap sync
# Usage: bash setup/android/apply-android-config.sh

set -e
PROJ_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_APP="$PROJ_ROOT/android/app/src/main"
ANDROID_RES="$ANDROID_APP/res/values"
ANDROID_JAVA="$ANDROID_APP/java/com/daqeeq/app"
ANDROID_MANIFEST="$ANDROID_APP/AndroidManifest.xml"

echo "🤖 Applying Android Health Connect configuration..."

# ── 1. Verify android directory ───────────────────────────────────────────────
if [ ! -d "$PROJ_ROOT/android" ]; then
  echo "❌ android/ not found. Run: npx cap add android"
  exit 1
fi

# ── 2. Patch AndroidManifest.xml ──────────────────────────────────────────────
if ! grep -q "android.permission.health.READ_EXERCISE" "$ANDROID_MANIFEST"; then
  # Insert permissions before <application> tag
  python3 - <<PYEOF
import re

with open("$ANDROID_MANIFEST", "r", encoding="utf-8") as f:
    content = f.read()

permissions = """
    <uses-permission android:name="android.permission.health.READ_EXERCISE"/>
    <uses-permission android:name="android.permission.health.WRITE_EXERCISE"/>
    <uses-permission android:name="android.permission.health.READ_NUTRITION"/>
    <uses-permission android:name="android.permission.health.WRITE_NUTRITION"/>
    <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
    <uses-permission android:name="android.permission.health.WRITE_WEIGHT"/>
    <uses-permission android:name="android.permission.health.READ_STEPS"/>
    <uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED"/>
    <uses-permission android:name="android.permission.health.WRITE_ACTIVE_CALORIES_BURNED"/>
    <uses-permission android:name="android.permission.health.READ_DISTANCE"/>
    <uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
    <uses-permission android:name="android.permission.health.READ_HYDRATION"/>
    <uses-permission android:name="android.permission.health.WRITE_HYDRATION"/>
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
"""

privacy_activity = """
        <activity
            android:name=".PrivacyPolicyActivity"
            android:exported="true"
            android:label="@string/privacy_policy_title">
          <intent-filter>
            <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
          </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".PrivacyPolicyActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
          <intent-filter>
            <action android:name="android.intent.action.VIEW_PERMISSION_USAGE"/>
            <category android:name="android.intent.category.HEALTH_PERMISSIONS"/>
          </intent-filter>
        </activity-alias>
"""

# Insert permissions before <application>
content = re.sub(r'(\s*<application)', permissions + r'\1', content, count=1)

# Insert activity before </application>
content = content.replace("</application>", privacy_activity + "\n    </application>")

with open("$ANDROID_MANIFEST", "w", encoding="utf-8") as f:
    f.write(content)

print("  ✅ AndroidManifest.xml patched")
PYEOF
else
  echo "  ℹ️  AndroidManifest.xml already has Health Connect permissions — skipped"
fi

# ── 3. Copy PrivacyPolicyActivity.java ────────────────────────────────────────
mkdir -p "$ANDROID_JAVA"
cp "$PROJ_ROOT/setup/android/PrivacyPolicyActivity.java" \
   "$ANDROID_JAVA/PrivacyPolicyActivity.java"
echo "  ✅ PrivacyPolicyActivity.java copied"

# ── 4. Patch strings.xml ──────────────────────────────────────────────────────
STRINGS_FILE="$ANDROID_RES/strings.xml"
if ! grep -q "privacy_policy_title" "$STRINGS_FILE"; then
  python3 - <<PYEOF
with open("$STRINGS_FILE", "r", encoding="utf-8") as f:
    content = f.read()

additions = """
    <string name="privacy_policy_title">سياسة الخصوصية</string>
    <string name="health_connect_rationale">يستخدم دقيق Health Connect لمزامنة تمارينك ووزنك وتغذيتك.</string>
"""
content = content.replace("</resources>", additions + "\n</resources>")

with open("$STRINGS_FILE", "w", encoding="utf-8") as f:
    f.write(content)

print("  ✅ strings.xml patched")
PYEOF
else
  echo "  ℹ️  strings.xml already patched — skipped"
fi

# ── 5. Copy privacy policy HTML to assets ────────────────────────────────────
ASSETS_SETUP="$PROJ_ROOT/android/app/src/main/assets/public/setup/android"
mkdir -p "$ASSETS_SETUP"
cp "$PROJ_ROOT/setup/android/privacy_policy.html" "$ASSETS_SETUP/privacy_policy.html"
echo "  ✅ privacy_policy.html copied to assets"

# ── 6. Sync Capacitor ─────────────────────────────────────────────────────────
echo ""
echo "Running npx cap sync android..."
cd "$PROJ_ROOT" && npx cap sync android

cat <<REMINDER

⚠️  ADDITIONAL STEPS REQUIRED:
  1. Open Android Studio: npx cap open android
  2. Build → Make Project (Ctrl+F9) to verify compilation
  3. Before Play Store submission:
     - Add your Privacy Policy URL to Google Play Console
     - Complete the Health Connect declaration form in Play Console
     - Await Google approval (typically 2-3 business days)
  4. Test on a device with Health Connect installed (Android 9+)
     - Health Connect is pre-installed on Android 14+
     - Download from Play Store on Android 9-13

REMINDER

echo "✅ Android configuration applied."
