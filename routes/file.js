import { Router } from 'express';
import Multer from 'multer';
import multerS3 from 'multer-s3';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const s3 = new AWS.S3();

const multer = Multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = file.originalname.split('.').pop();
      const folder = req.body.folder || 'general';
      cb(null, `${folder}/${timestamp}.${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
});

// 단일 파일 업로드
router.post('/upload', multer.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { description, folder } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileData = {
      filename: file.originalname,
      url: file.location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'general',
      description: description || null,
      uploaded_at: new Date()
    };

    res.status(200).json({ 
      success: true,
      data: fileData,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 다중 파일 업로드
router.post('/upload-multiple', multer.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    const { folder } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const filesData = files.map(file => ({
      filename: file.originalname,
      url: file.location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'general',
      uploaded_at: new Date()
    }));

    res.status(200).json({ 
      success: true,
      data: filesData,
      message: `${files.length} files uploaded successfully`
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 이미지 전용 업로드 (최적화된 설정)
router.post('/upload-image', multer.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const { alt_text, folder } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // 이미지 파일 타입 체크
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    const imageData = {
      filename: file.originalname,
      url: file.location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'images',
      alt_text: alt_text || null,
      uploaded_at: new Date()
    };

    res.status(200).json({ 
      success: true,
      data: imageData,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 파일 삭제 (S3에서)
router.delete('/delete', async (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // URL에서 S3 키 추출
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // 첫 번째 '/' 제거

    const deleteParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();

    res.status(200).json({ 
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 파일 정보 조회 (S3에서)
router.get('/info', async (req, res) => {
  try {
    const { fileUrl } = req.query;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // URL에서 S3 키 추출
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    const headParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    };

    const data = await s3.headObject(headParams).promise();

    const fileInfo = {
      size: data.ContentLength,
      mimetype: data.ContentType,
      lastModified: data.LastModified,
      etag: data.ETag
    };

    res.status(200).json({ 
      success: true,
      data: fileInfo
    });
  } catch (error) {
    if (error.code === 'NotFound') {
      return res.status(404).json({ 
        error: 'File not found' 
      });
    }
    
    console.error('Error getting file info:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;