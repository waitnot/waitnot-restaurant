import express from 'express';
const router = express.Router();

// ─── RELEASE PROCESS ──────────────────────────────────────────────────────────
// Every release requires ALL of the following steps — in this order:
//
//  1.  Increment `versionCode` below  (+1 from previous release).
//  2.  Update `version` string (semver, e.g. "1.0.6").
//  3.  Write `releaseNotes` (bullet points shown to users in the update dialog).
//  4.  Set `downloadUrl` to the public HTTPS URL of the new signed APK.
//  5.  In client/src/main-captain.jsx  →  bump  CURRENT_VERSION_CODE  to match.
//  6.  In client/android/app/build.gradle  →  bump  versionCode  to match.
//  7.  In client/android/app/build.gradle  →  bump  versionName  to match.
//  8.  Build the APK via GitHub Actions (Build Captain APK workflow).
//  9.  Sign the APK with the SAME production signing key as the installed APK.
//      (Android rejects updates signed with a different key.)
// 10.  Upload the signed APK to the location in `downloadUrl`.
// 11.  Push this file to GitHub → Render auto-deploys.
// 12.  Wait ~60s for Render to finish deployment.
// 13.  Test: install the PREVIOUS version, verify the update dialog appears.
// 14.  Test: install the NEW version, verify no update dialog appears.
//
// NEVER set server versionCode ahead of the APK versionCode before the APK
// is built and uploaded — users would download a non-existent file.
//
// ROLLBACK RULE: Android blocks downgrades (e.g. v6→v5).
// To fix a bad release, build v7 with the fix and set server versionCode = 7.
// ─────────────────────────────────────────────────────────────────────────────

// ─── FORCE UPDATE LOGIC ───────────────────────────────────────────────────────
// `forceUpdate`               → hides "Remind me later", blocks app use.
// `minimumSupportedVersionCode` → any APK BELOW this version sees a force update
//   regardless of `forceUpdate`. Example:
//     versionCode = 6, minimumSupportedVersionCode = 5
//     APK at 4 → forced (4 < 5). APK at 5 → optional (5 >= 5). APK at 6 → none.
// ─────────────────────────────────────────────────────────────────────────────

const APP_VERSION = {
  // ── Increment both on every release ──
  version:     '1.0.5',
  versionCode: 5,           // must match APK CURRENT_VERSION_CODE and build.gradle versionCode

  releaseNotes: 'Bug fixes and performance improvements.',

  // forceUpdate: forces ALL users to update immediately (hides "Remind me later")
  forceUpdate: false,

  // minimumSupportedVersionCode: APKs below this receive a forced update.
  // Set equal to versionCode when no minimum is enforced.
  minimumSupportedVersionCode: 1,

  // Direct HTTPS URL to the signed APK — must be the same trusted production domain.
  downloadUrl: 'https://waitnot-restaurant1.onrender.com/downloads/waitnot-captain.apk',

  // Optional metadata (used by future clients; ignored by current APK versions)
  releaseDate: new Date().toISOString().split('T')[0],
};

router.get('/', (req, res) => {
  // Derive forceUpdate from minimumSupportedVersionCode at request time.
  // Clients that pass ?installedVersion=N get an accurate forceUpdate flag.
  const installedVersion = parseInt(req.query.installedVersion) || 0;
  const isForced = APP_VERSION.forceUpdate ||
    (installedVersion > 0 && installedVersion < APP_VERSION.minimumSupportedVersionCode);

  res.json({
    ...APP_VERSION,
    forceUpdate: isForced,
  });
});

export default router;
