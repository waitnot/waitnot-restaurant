// Video storage utility
// For production, replace this with actual cloud storage (AWS S3, Cloudinary, etc.)

export const uploadVideo = async (file, onProgress) => {
  // Simulate cloud upload with base64 encoding
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    };
    
    reader.onload = () => {
      // In production, this would upload to cloud storage and return a URL
      // For now, we return the base64 data URL
      resolve(reader.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to upload video'));
    };
    
    reader.readAsDataURL(file);
  });
};

// For production implementation:
/*
export const uploadVideo = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('video', file);
  
  const response = await fetch('/api/upload/video', {
    method: 'POST',
    body: formData,
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      if (onProgress) onProgress(progress);
    }
  });
  
  const data = await response.json();
  return data.url; // Returns the cloud storage URL
};
*/
