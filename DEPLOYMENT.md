# Deployment Guide - WaitNot

## Current Setup (Development)

The application currently uses:
- **Local JSON files** for data storage (`server/data/`)
- **Base64 encoding** for uploaded videos (max 10MB)
- **Local file system** for all data

## Production Deployment Recommendations

### 1. Database Migration

**Current:** Local JSON files
**Recommended:** MongoDB Atlas, PostgreSQL, or MySQL

```javascript
// Replace server/db.js with actual database connection
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI);
```

### 2. Video Storage (CRITICAL)

**Current:** Base64 encoding (limited to 10MB)
**Recommended:** Cloud storage service

#### Option A: AWS S3
```javascript
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

// Example: Upload menu item images
export const uploadImage = async (file) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `menu-images/${Date.now()}-${file.name}`,
    Body: file,
    ContentType: file.type,
    ACL: 'public-read'
  };
  
  const result = await s3.upload(params).promise();
  return result.Location; // Returns public URL
};
```

#### Option B: Cloudinary
```javascript
import cloudinary from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadImage = async (file) => {
  const result = await cloudinary.v2.uploader.upload(file.path, {
    resource_type: 'image',
    folder: 'waitnot-menu'
  });
  return result.secure_url;
};
```

#### Option C: Firebase Storage
```javascript
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadImage = async (file) => {
  const storageRef = ref(storage, `menu-images/${Date.now()}-${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};
```

### 3. Backend Upload Endpoint

Add to `server/routes/upload.js`:

```javascript
import express from 'express';
import multer from 'multer';
import { uploadVideo } from '../utils/videoStorage.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.post('/video', upload.single('video'), async (req, res) => {
  try {
    const videoUrl = await uploadVideo(req.file);
    res.json({ url: videoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 4. Frontend Upload Update

Update `client/src/pages/RestaurantDashboard.jsx`:

```javascript
const uploadVideoFile = async (file) => {
  const formData = new FormData();
  formData.append('video', file);
  
  const response = await axios.post('/api/upload/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      setUploadProgress(progress);
    }
  });
  
  return response.data.url;
};
```

### 5. Environment Variables

Create `.env` files:

**Server (.env):**
```
PORT=5000
JWT_SECRET=your_secure_jwt_secret

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/waitnot

# AWS S3 (if using)
AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
S3_BUCKET=waitnot-videos
AWS_REGION=us-east-1

# Cloudinary (if using)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Firebase (if using)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket
```

**Client (.env):**
```
VITE_API_URL=https://your-api-domain.com
```

### 6. Hosting Options

**Frontend:**
- Vercel (recommended for React)
- Netlify
- AWS Amplify
- Firebase Hosting

**Backend:**
- Heroku
- Railway
- Render
- AWS EC2/ECS
- DigitalOcean

### 7. Deployment Steps

1. **Setup Cloud Storage:**
   - Create AWS S3 bucket / Cloudinary account / Firebase project
   - Configure CORS for video access
   - Get API credentials

2. **Setup Database:**
   - Create MongoDB Atlas cluster / PostgreSQL instance
   - Import seed data
   - Update connection string

3. **Deploy Backend:**
   ```bash
   cd server
   npm install
   npm run build
   # Deploy to hosting service
   ```

4. **Deploy Frontend:**
   ```bash
   cd client
   npm install
   npm run build
   # Deploy dist folder to hosting service
   ```

5. **Configure Environment Variables:**
   - Add all env vars to hosting platform
   - Update API URLs

6. **Test:**
   - Upload test images
   - Verify images display correctly
   - Test all features

### 8. Performance Optimization

- Enable CDN for image delivery
- Implement image compression
- Add lazy loading for images
- Use image thumbnails
- Implement caching

### 9. Security

- Add authentication middleware
- Validate file types and sizes
- Sanitize user inputs
- Enable HTTPS
- Add rate limiting
- Implement CORS properly

### 10. Monitoring

- Setup error tracking (Sentry)
- Add analytics (Google Analytics)
- Monitor video storage usage
- Track API performance

## Quick Start for Production

1. Choose cloud storage provider
2. Implement upload endpoint
3. Update frontend upload function
4. Deploy to hosting
5. Test thoroughly

## Cost Estimates

**AWS S3:**
- Storage: $0.023/GB/month
- Transfer: $0.09/GB
- Requests: $0.005/1000 requests

**Cloudinary:**
- Free tier: 25GB storage, 25GB bandwidth
- Paid: Starting at $99/month

**Firebase:**
- Free tier: 5GB storage, 1GB/day transfer
- Paid: Pay as you go

Choose based on your expected traffic and budget!
