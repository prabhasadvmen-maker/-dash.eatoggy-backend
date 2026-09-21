import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import crypto from 'crypto';

let s3ClientInstance = null;

const getS3Client = () => {
  if (!s3ClientInstance) {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const endpoint = process.env.R2_ENDPOINT || '';

    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      }
    });
  }
  return s3ClientInstance;
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP, PDF, and MP4 are allowed.`));
    }
  }
});

export const uploadToR2 = async (file, folder = 'uploads') => {
  if (!file) return null;

  const ext = path.extname(file.originalname);
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = `${folder}/${randomName}${ext}`;

  try {
    const client = getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const baseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    return `${baseUrl}/${filename}`;
  } catch (err) {
    console.error(`R2 Upload warning for ${filename}:`, err.message || err);
    // Fallback: If R2 fails or credentials are invalid, return base64 Data URL so application submission never crashes
    const base64 = file.buffer.toString('base64');
    return `data:${file.mimetype};base64,${base64}`;
  }
};

export const getPresignedUrl = async (keyOrUrl) => {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return keyOrUrl;
  if (keyOrUrl.startsWith('data:')) return keyOrUrl;

  try {
    let key = keyOrUrl;
    if (keyOrUrl.includes('.r2.dev/')) {
      key = keyOrUrl.split('.r2.dev/')[1];
    } else if (keyOrUrl.includes('.cloudflarestorage.com/')) {
      key = keyOrUrl.split('.cloudflarestorage.com/')[1];
      if (key.startsWith(`${process.env.R2_BUCKET}/`)) {
        key = key.replace(`${process.env.R2_BUCKET}/`, '');
      }
    }

    key = key.replace(/^\//, '');

    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    // Valid for 24 hours
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 86400 });
    return signedUrl;
  } catch (err) {
    console.error('Error generating presigned URL for:', keyOrUrl, err.message);
    return keyOrUrl;
  }
};

export const getPresignedDocumentUrls = async (documentsObj) => {
  if (!documentsObj) return {};
  const signedDocs = {};
  const rawObj = documentsObj.toObject ? documentsObj.toObject() : documentsObj;

  for (const [key, val] of Object.entries(rawObj)) {
    if (val && typeof val === 'string') {
      signedDocs[key] = await getPresignedUrl(val);
    } else {
      signedDocs[key] = val;
    }
  }
  return signedDocs;
};
