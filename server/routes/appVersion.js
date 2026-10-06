import express from 'express';
const router = express.Router();

// Update these whenever you build and release a new APK
const APP_VERSION = {
  version: '1.0.1',           // bump this with each release
  versionCode: 2,              // integer, must increase each release
  apkUrl: 'https://github.com/waitnot/waitnot-restaurant/releases/latest/download/waitnot-captain.apk',
  releaseNotes: 'Bug fixes and performance improvements',
  forceUpdate: false           // set true to block old versions
};

router.get('/', (req, res) => {
  res.json(APP_VERSION);
});

export default router;
