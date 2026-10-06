import express from 'express';
const router = express.Router();

// Bump versionCode each time you deploy a new APK.
// The APK's CURRENT_VERSION_CODE is hardcoded at build time.
// If server versionCode > app versionCode → update prompt appears.
// Set versionCode equal to CURRENT_VERSION_CODE (1) when no update is available.
//
// To release a new update:
//   1. Build new APK and bump CURRENT_VERSION_CODE in main-captain.jsx (e.g. → 2)
//   2. Upload APK somewhere and set downloadUrl below
//   3. Set versionCode below to match the new APK's CURRENT_VERSION_CODE
//   4. Deploy the server — all old APKs will see the update prompt
//
// To hide the update prompt (no update available):
//   Set versionCode equal to the current APK's CURRENT_VERSION_CODE
const APP_VERSION = {
  version: '1.0.2',
  versionCode: 2,          // bumped → older APKs (versionCode 1) will see update prompt
  releaseNotes: 'Fix: triple/double print bug fixed. Paper width (58mm/80mm) now respected.',
  forceUpdate: false,
  downloadUrl: '',         // will be filled after APK is built and uploaded
};

router.get('/', (req, res) => {
  res.json(APP_VERSION);
});

export default router;
