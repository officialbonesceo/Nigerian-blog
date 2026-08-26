/**
 * Cloudinary Unsigned Image Uploader for 9jaBeacon
 * Cloud Name: phwka7ak
 * Unsigned Preset: voxawell
 * Automatically uploads all news images and returns secure Cloudinary CDN URLs.
 */

export interface CloudinaryUploadOptions {
  cloudName?: string;
  uploadPreset?: string;
  folder?: string;
}

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  originalUrl: string;
  publicId?: string;
  format?: string;
  bytes?: number;
  error?: string;
}

export async function uploadToCloudinaryDetailed(
  fileOrUrl: string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const cloudName = (options.cloudName || process.env.CLOUDINARY_CLOUD_NAME || 'phwka7ak').trim();
  const uploadPreset = (options.uploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET || 'voxawell').trim();

  if (!fileOrUrl) {
    return { success: false, url: '', originalUrl: '', error: 'Empty file or URL provided' };
  }

  // If already hosted on Cloudinary, return as is
  if (fileOrUrl.includes('res.cloudinary.com')) {
    return { success: true, url: fileOrUrl, originalUrl: fileOrUrl };
  }

  try {
    const formData = new FormData();
    formData.append('file', fileOrUrl);
    formData.append('upload_preset', uploadPreset);
    if (options.folder) {
      formData.append('folder', options.folder);
    } else {
      formData.append('folder', '9jabeacon/articles');
    }

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json() as any;
      if (data.secure_url) {
        return {
          success: true,
          url: data.secure_url,
          originalUrl: fileOrUrl,
          publicId: data.public_id,
          format: data.format,
          bytes: data.bytes,
        };
      }
    }

    const errText = await res.text();
    return {
      success: false,
      url: fileOrUrl,
      originalUrl: fileOrUrl,
      error: `HTTP ${res.status}: ${errText.slice(0, 120)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      url: fileOrUrl,
      originalUrl: fileOrUrl,
      error: err.message || 'Unknown network error during upload',
    };
  }
}

export async function uploadToCloudinary(
  fileOrUrl: string,
  options: CloudinaryUploadOptions = {}
): Promise<string> {
  const result = await uploadToCloudinaryDetailed(fileOrUrl, options);
  return result.url;
}

/**
 * Diagnostic test to verify Cloudinary unsigned preset connectivity
 */
export async function verifyCloudinaryConnection(
  cloudName = 'phwka7ak',
  uploadPreset = 'voxawell'
): Promise<{ verified: boolean; message: string }> {
  try {
    // 1x1 transparent GIF data URI for instant verification
    const testPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const formData = new FormData();
    formData.append('file', testPixel);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', '9jabeacon/_tests');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json() as any;
      return {
        verified: true,
        message: `Cloudinary Unsigned Preset "${uploadPreset}" on Cloud "${cloudName}" is VERIFIED and active (Secure URL: ${data.secure_url})`,
      };
    } else {
      const errText = await res.text();
      return {
        verified: false,
        message: `Cloudinary response HTTP ${res.status}: ${errText.slice(0, 150)}`,
      };
    }
  } catch (err: any) {
    return {
      verified: false,
      message: `Cloudinary network verification error: ${err.message}`,
    };
  }
}

