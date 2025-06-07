import { Router } from 'express';
import multer from 'multer';
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import UserRepository from '../db/user/UserRepository.js';
import CardRepository from '../db/card/CardRepository.js';
import MysqlPoolProvider from '../db/provider.js';

dotenv.config();

const router = Router();
const userRepository = new UserRepository(MysqlPoolProvider.getPool());
const cardRepository = new CardRepository(MysqlPoolProvider.getPool());

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
      'text/plain'];
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
  };

  const upload = new Upload({
    client: s3Client,
    params: uploadParams,
  });

  const result = await upload.done();
  return {
    location: result.Location,
    key: key,
    bucket: process.env.S3_BUCKET_NAME,
  };
}

// 프로필 이미지 업로드 (유저 ID와 연동)
router.post('/upload-profile', upload.single('profileImage'), async (req, res) => {
  try {
    const file = req.file;
    const { userId } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No profile image uploaded' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // 유저 존재 확인
    const existingUser = await userRepository.getUserById(parseInt(userId));
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 이미지 파일인지 확인
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed for profile' });
    }

    // 기존 프로필 이미지가 있다면 S3에서 삭제
    if (existingUser.profile_img_url) {
      try {
        const oldUrl = new URL(existingUser.profile_img_url);
        const oldKey = oldUrl.pathname.substring(1);
        
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: oldKey
        });
        
        await s3Client.send(deleteCommand);
      } catch (deleteError) {
        console.warn('Failed to delete old profile image:', deleteError);
        // 기존 이미지 삭제 실패해도 새 이미지 업로드는 계속 진행
      }
    }

    // 새 프로필 이미지 업로드
    const uploadResult = await uploadToS3(file, `profiles/${userId}`);

    // 데이터베이스에 프로필 이미지 URL 업데이트
    await userRepository.updateProfileImage(parseInt(userId), uploadResult.location);

    const profileData = {
      userId: parseInt(userId),
      filename: file.originalname,
      url: uploadResult.location,
      size: file.size,
      mimetype: file.mimetype,
      uploaded_at: new Date()
    };

    res.status(200).json({ 
      success: true,
      data: profileData,
      message: 'Profile image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 카드 이미지 업로드 (카드 ID와 연동)
router.post('/upload-card-image', upload.single('cardImage'), async (req, res) => {
  try {
    const file = req.file;
    const { cardId } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No card image uploaded' });
    }

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID is required' });
    }

    // 카드 존재 확인
    const existingCard = await cardRepository.getCardById(parseInt(cardId));
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // 이미지 파일인지 확인
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed for card image' });
    }

    // 기존 카드 이미지가 있다면 S3에서 삭제
    if (existingCard.card_image_url) {
      try {
        const oldUrl = new URL(existingCard.card_image_url);
        const oldKey = oldUrl.pathname.substring(1);
        
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: oldKey
        });
        
        await s3Client.send(deleteCommand);
      } catch (deleteError) {
        console.warn('Failed to delete old card image:', deleteError);
        // 기존 이미지 삭제 실패해도 새 이미지 업로드는 계속 진행
      }
    }

    // 새 카드 이미지 업로드
    const uploadResult = await uploadToS3(file, `cards/${cardId}`);

    // 데이터베이스에 카드 이미지 URL 업데이트
    await cardRepository.updateCardImage(parseInt(cardId), uploadResult.location);

    const cardImageData = {
      cardId: parseInt(cardId),
      filename: file.originalname,
      url: uploadResult.location,
      size: file.size,
      mimetype: file.mimetype,
      uploaded_at: new Date()
    };

    res.status(200).json({ 
      success: true,
      data: cardImageData,
      message: 'Card image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading card image:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 단일 파일 업로드 (유저 ID 옵션 추가)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { description, folder, userId } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // userId가 제공된 경우 유저 존재 확인
    if (userId) {
      const existingUser = await userRepository.getUserById(parseInt(userId));
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
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
      userId: userId ? parseInt(userId) : null,
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

// 다중 파일 업로드 (유저 ID 옵션 추가)
router.post('/upload-multiple', upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    const { folder, userId } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // userId가 제공된 경우 유저 존재 확인
    if (userId) {
      const existingUser = await userRepository.getUserById(parseInt(userId));
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // 모든 파일을 S3에 업로드
    const uploadPromises = files.map(file => uploadToS3(file, folder));
    const uploadResults = await Promise.all(uploadPromises);

    // Map each file to create consistent metadata structure
    const filesData = files.map((file, index) => ({
      filename: file.originalname,
      url: uploadResults[index].location,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder || 'general',
      userId: userId ? parseInt(userId) : null,
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

// 이미지 전용 업로드 (유저 ID 옵션 추가)
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const { alt_text, folder, userId } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Validate that uploaded file is actually an image
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // userId가 제공된 경우 유저 존재 확인
    if (userId) {
      const existingUser = await userRepository.getUserById(parseInt(userId));
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
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
      userId: userId ? parseInt(userId) : null,
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

// 유저별 파일 목록 조회
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // 유저 존재 확인
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 유저의 프로필 이미지 URL을 포함한 파일 목록
    const userFiles = {
      profileImage: existingUser.profile_img_url || null
    };

    res.status(200).json({ 
      success: true,
      data: userFiles
    });
  } catch (error) {
    console.error('Error fetching user files:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 파일 삭제 (S3에서)
router.delete('/delete', async (req, res) => {
  try {
    const { fileUrl, userId } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // userId가 제공된 경우 권한 확인 (선택적)
    if (userId) {
      const existingUser = await userRepository.getUserById(parseInt(userId));
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Extract the S3 object key from the full URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove the leading '/'

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(deleteCommand);

    // 프로필 이미지인 경우 데이터베이스에서도 URL 제거
    if (userId && key.includes(`profiles/${userId}`)) {
      await userRepository.updateProfileImage(parseInt(userId), null);
    }

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

    // Extract S3 key from URL for metadata lookup
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    const headCommand = new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });

    const data = await s3Client.send(headCommand);

    // Return relevant file information
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
    // Handle specific case where file doesn't exist
    if (error.name === 'NotFound') {
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