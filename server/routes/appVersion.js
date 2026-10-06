import express from 'express';
const router = express.Router();

// Bump versionCode each time you deploy new features.
// The APK's CURRENT_VERSION_CODE is hardcoded at build time.
// If server versionCode > app versionCode → update prompt appears.
const APP_VERSION = {
  version: '1.0.1',
  versionCode: 2,
  releaseNotes: 'Bug fixes and performance improvements',
  forceUpdate: false
};

router.get('/', (req, res) => {
  res.json(APP_VERSION);
});

export default router;
