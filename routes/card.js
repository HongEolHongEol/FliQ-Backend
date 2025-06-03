import { Router } from 'express';
import CardRepository from '../db/card/CardRepository.js';
import QuestionRepository from '../db/question/QuestionRepository.js';
import SnsRepository from '../db/sns/SnsRepository.js';
import TagRepository from '../db/tag/TagRepository.js';
import SharedCardRepository from '../db/shared/SharedCardRepository.js';
import MysqlPoolProvider from '../db/provider.js';
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

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
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// S3 업로드 함수
async function uploadImageToS3(file, folder = 'card', id = null) {
  const timestamp = Date.now();
  const ext = file.originalname.split('.').pop();
  const key = `${folder}/${id || timestamp}-${uuidv4()}.${ext}`;

  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  };

  const uploadInstance = new Upload({
    client: s3Client,
    params: uploadParams,
  });

  const result = await uploadInstance.done();
  return {
    location: result.Location,
    key: key,
    bucket: process.env.S3_BUCKET_NAME,
  };
}

const cardRepository = new CardRepository(MysqlPoolProvider.getPool());
const questionRepository = new QuestionRepository(MysqlPoolProvider.getPool());
const snsRepository = new SnsRepository(MysqlPoolProvider.getPool());
const tagRepository = new TagRepository(MysqlPoolProvider.getPool());
const sharedCardRepository = new SharedCardRepository(MysqlPoolProvider.getPool());

// 카드 정보 업로드 (생성)
router.post('/upload', async (req, res) => {
  const {
    name,
    contact,
    email,
    organization,
    position,
    introduction,
    user_id,
    _private,
    card_image_url,
    profile_image_url,
    questions,
    sns_links,
    tags,
  } = req.body;

  if (!name || !user_id) {
    return res.status(400).json({ 
      error: 'Name and user_id are required fields' 
    });
  }

  const connection = await MysqlPoolProvider.getPool().getConnection();
  try {
    await connection.beginTransaction();

    const card = {
      name,
      contact,
      email,
      organization,
      position,
      introduction,
      user_id: parseInt(user_id),
      _private: _private === 'true' || _private === true,
      card_image_url,
      profile_image_url,
    };

    const cardResult = await cardRepository.insertCard(card);
    const cardId = cardResult.insertId;

    // 질문 추가
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        if (q.question && q.answer) {
          await questionRepository.insertQuestion({
            question: q.question,
            answer: q.answer,
            card_id: cardId,
          });
        }
      }
    }

    // SNS 링크 추가
    if (sns_links && Array.isArray(sns_links)) {
      for (const sns of sns_links) {
        if (sns.platform && sns.url) {
          await snsRepository.insertSns({
            platform: sns.platform,
            url: sns.url,
            card_id: cardId,
          });
        }
      }
    }

    // 태그 추가
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        if (tagName.trim()) {
          const tagResult = await tagRepository.insertTag(tagName.trim());
          const tagId = tagResult.insertId || (await tagRepository.getTagByName(tagName.trim())).id;
          await tagRepository.addCardTag(cardId, tagId);
        }
      }
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      data: { ...cardResult, id: cardId },
      message: 'Card created successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error inserting card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  } finally {
    connection.release();
  }
});

// 카드 수정
router.put('/:cardId', async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const {
    name,
    contact,
    email,
    organization,
    position,
    introduction,
    _private,
    card_image_url,
    profile_image_url,
    questions,
    sns_links,
    tags,
  } = req.body;

  if (!name) {
    return res.status(400).json({ 
      error: 'Name is required' 
    });
  }

  const connection = await MysqlPoolProvider.getPool().getConnection();
  try {
    await connection.beginTransaction();

    const card = {
      name,
      contact,
      email,
      organization,
      position,
      introduction,
      _private: _private === 'true' || _private === true,
      card_image_url,
      profile_image_url,
    };

    await cardRepository.updateCard(cardId, card);

    // 기존 관련 데이터 삭제
    await questionRepository.deleteQuestionsByCardId(cardId);
    await snsRepository.deleteSnsByCardId(cardId);
    await tagRepository.removeAllCardTags(cardId);

    // 새로운 데이터 추가
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        if (q.question && q.answer) {
          await questionRepository.insertQuestion({
            question: q.question,
            answer: q.answer,
            card_id: cardId,
          });
        }
      }
    }

    if (sns_links && Array.isArray(sns_links)) {
      for (const sns of sns_links) {
        if (sns.platform && sns.url) {
          await snsRepository.insertSns({
            platform: sns.platform,
            url: sns.url,
            card_id: cardId,
          });
        }
      }
    }

    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        if (tagName.trim()) {
          const tagResult = await tagRepository.insertTag(tagName.trim());
          const tagId = tagResult.insertId || (await tagRepository.getTagByName(tagName.trim())).id;
          await tagRepository.addCardTag(cardId, tagId);
        }
      }
    }

    await connection.commit();
    res.status(200).json({ 
      success: true, 
      message: 'Card updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  } finally {
    connection.release();
  }
});

// 카드 삭제
router.delete('/:cardId', async (req, res) => {
  const cardId = parseInt(req.params.cardId);

  const connection = await MysqlPoolProvider.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 관련 데이터 모두 삭제
    await questionRepository.deleteQuestionsByCardId(cardId);
    await snsRepository.deleteSnsByCardId(cardId);
    await tagRepository.removeAllCardTags(cardId);
    
    const result = await cardRepository.deleteCard(cardId);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        error: 'Card not found' 
      });
    }

    await connection.commit();
    res.status(200).json({ 
      success: true, 
      message: 'Card deleted successfully' 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  } finally {
    connection.release();
  }
});

// 카드 상세 조회 (질문, SNS, 태그 포함)
router.get('/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId);
    
    const card = await cardRepository.getCardById(cardId);
    if (!card) {
      return res.status(404).json({ 
        error: 'Card not found' 
      });
    }

    const questions = await questionRepository.getQuestionsByCardId(cardId);
    const sns_links = await snsRepository.getSnsByCardId(cardId);
    const tags = await tagRepository.getTagsByCard(cardId);

    res.status(200).json({ 
      success: true, 
      data: {
        ...card,
        questions,
        sns_links,
        tags,
      }
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 사용자별 카드 조회
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cards = await cardRepository.getAllCardsByUser(userId);
    
    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(card.id);
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);
        
        return {
          ...card,
          questions,
          sns_links,
          tags,
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: cardsWithDetails 
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 공유받은 카드 조회
router.get('/shared/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cards = await sharedCardRepository.getSharedCardsByUser(userId);
    
    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(card.id);
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);
        
        return {
          ...card,
          questions,
          sns_links,
          tags,
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: cardsWithDetails 
    });
  } catch (error) {
    console.error('Error fetching shared cards:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 카드 공유
router.post('/share', async (req, res) => {
  const { userId, cardId } = req.body;

  if (!userId || !cardId) {
    return res.status(400).json({ 
      error: 'userId and cardId are required' 
    });
  }

  try {
    // 이미 공유된 카드인지 확인
    const isShared = await sharedCardRepository.checkIfCardShared(userId, cardId);
    if (isShared) {
      return res.status(409).json({ 
        error: 'Card already shared with this user' 
      });
    }

    await sharedCardRepository.shareCard(userId, cardId);
    res.status(201).json({ 
      success: true, 
      message: 'Card shared successfully' 
    });
  } catch (error) {
    console.error('Error sharing card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 공유 카드 삭제 (즐겨찾기 해제)
router.delete('/shared/:userId/:cardId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cardId = parseInt(req.params.cardId);
    
    const result = await sharedCardRepository.removeSharedCard(userId, cardId);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Shared card not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Shared card removed successfully' 
    });
  } catch (error) {
    console.error('Error removing shared card:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 카드 링크 생성
router.post('/generate-link/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId);
    
    const shareToken = await cardRepository.generateCardLink(cardId);
    const shareUrl = `${req.protocol}://${req.get('host')}/card/shared-link/${shareToken}`;
    
    res.status(200).json({ 
      success: true, 
      data: {
        shareToken,
        shareUrl,
      },
      message: 'Share link generated successfully'
    });
  } catch (error) {
    console.error('Error generating share link:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 공유 링크로 카드 조회
router.get('/shared-link/:shareToken', async (req, res) => {
  try {
    const shareToken = req.params.shareToken;
    
    const card = await cardRepository.getCardByShareToken(shareToken);
    if (!card) {
      return res.status(404).json({ 
        error: 'Card not found or link expired' 
      });
    }

    const questions = await questionRepository.getQuestionsByCardId(card.id);
    const sns_links = await snsRepository.getSnsByCardId(card.id);
    const tags = await tagRepository.getTagsByCard(card.id);

    res.status(200).json({ 
      success: true, 
      data: {
        ...card,
        questions,
        sns_links,
        tags,
      }
    });
  } catch (error) {
    console.error('Error fetching card by share link:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 이미지 업로드 (프로필, 명함 사진)
router.post('/upload-image', upload.fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'card_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;
    if (!files || (Object.keys(files).length === 0)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const result = {};
    
    if (files.profile_image) {
      const uploadResult = await uploadImageToS3(files.profile_image[0], 'profile', req.body.id);
      result.profile_image_url = uploadResult.location;
    }
    
    if (files.card_image) {
      const uploadResult = await uploadImageToS3(files.card_image[0], 'card', req.body.id);
      result.card_image_url = uploadResult.location;
    }

    res.status(200).json({ 
      success: true,
      data: result,
      message: 'Images uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 태그별 카드 조회
router.get('/tag/:tagId/:userId', async (req, res) => {
  try {
    const tagId = parseInt(req.params.tagId);
    const userId = parseInt(req.params.userId);
    
    const cards = await tagRepository.getCardsByTag(tagId, userId);
    
    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(card.id);
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);
        
        return {
          ...card,
          questions,
          sns_links,
          tags,
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: cardsWithDetails 
    });
  } catch (error) {
    console.error('Error fetching cards by tag:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 공개 카드 조회
router.get('/public/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId ? parseInt(req.params.userId) : null;
    const cards = await cardRepository.getPublicCards(userId);
    
    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(card.id);
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);
        
        return {
          ...card,
          questions,
          sns_links,
          tags,
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: cardsWithDetails 
    });
  } catch (error) {
    console.error('Error fetching public cards:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 카드 검색
router.get('/search/:searchTerm/:userId?', async (req, res) => {
  try {
    const searchTerm = req.params.searchTerm;
    const userId = req.params.userId ? parseInt(req.params.userId) : null;
    
    const cards = await cardRepository.searchCards(searchTerm, userId);
    
    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(card.id);
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);
        
        return {
          ...card,
          questions,
          sns_links,
          tags,
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: cardsWithDetails 
    });
  } catch (error) {
    console.error('Error searching cards:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;