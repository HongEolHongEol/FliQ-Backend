import { Router } from 'express';
import multer from 'multer';
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// AWS S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer 메모리 스토리지 설정
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 파일 타입 검증
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
});

// S3 업로드 함수
async function uploadToS3(file, folder = 'general') {
  const timestamp = Date.now();
  const ext = file.originalname.split('.').pop();
  const key = `${folder}/${timestamp}-${uuidv4()}.${ext}`;

  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    //ACL: 'public-read',
  };

  const upload = new Upload({ client: s3Client, params: uploadParams });

  const result = await upload.done();
  return {
    location: result.Location,
    key: key,
    bucket: process.env.S3_BUCKET_NAME,
  };
}

// 단일 파일 업로드
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { description, folder } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadResult = await uploadToS3(file, folder);

    // Create file metadata object with all relevant information
    const fileData = {
      filename: file.originalname,
      url: uploadResult.location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'general',
      description: description || null,
      uploaded_at: new Date(),
    };

    res
      .status(200)
      .json({
        success: true,
        data: fileData,
        message: 'File uploaded successfully',
      });
  } catch (error) {
    console.error('Error uploading file:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 다중 파일 업로드
router.post('/upload-multiple', upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    const { folder } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // 모든 파일을 S3에 업로드
    const uploadPromises = files.map((file) => uploadToS3(file, folder));
    const uploadResults = await Promise.all(uploadPromises);

    // Map each file to create consistent metadata structure
    const filesData = files.map((file, index) => ({
      filename: file.originalname,
      url: uploadResults[index].location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'general',
      uploaded_at: new Date(),
    }));

    res
      .status(200)
      .json({
        success: true,
        data: filesData,
        message: `${files.length} files uploaded successfully`,
      });
  } catch (error) {
    console.error('Error uploading files:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 이미지 전용 업로드 (최적화된 설정)
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const { alt_text, folder } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Validate that uploaded file is actually an image
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    const uploadResult = await uploadToS3(file, folder || 'images');

    // Create image-specific metadata with alt text for accessibility
    const imageData = {
      filename: file.originalname,
      url: uploadResult.location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'images',
      alt_text: alt_text || null,
      uploaded_at: new Date(),
    };

    res
      .status(200)
      .json({
        success: true,
        data: imageData,
        message: 'Image uploaded successfully',
      });
  } catch (error) {
    console.error('Error uploading image:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 파일 삭제 (S3에서)
router.delete('/delete', async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // Extract the S3 object key from the full URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove the leading '/'

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(deleteCommand);

    res
      .status(200)
      .json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 파일 정보 조회 (S3에서)
router.get('/info', async (req, res) => {
  try {
    const { fileUrl } = req.query;

    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // Extract S3 key from URL for metadata lookup
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    const headCommand = new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    const data = await s3Client.send(headCommand);

    // Return relevant file information
    const fileInfo = {
      size: data.ContentLength,
      mimetype: data.ContentType,
      lastModified: data.LastModified,
      etag: data.ETag,
    };

    res.status(200).json({ success: true, data: fileInfo });
  } catch (error) {
    // Handle specific case where file doesn't exist
    if (error.name === 'NotFound') {
      return res.status(404).json({ error: 'File not found' });
    }

    console.error('Error getting file info:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

export default router;
