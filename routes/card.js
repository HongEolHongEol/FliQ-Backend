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
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { exec } from 'child_process';

exec('which python3', (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Python3 경로 확인 실패: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`❌ Python3 경로 확인 오류: ${stderr}`);
    return;
  }
  const pythonPath = stdout.trim();
  console.log(`🐍 Python3 경로: ${pythonPath}`)
  if (!fs.existsSync(pythonPath)) {
    console.error(`❌ Python3 경로가 존재하지 않습니다: ${pythonPath}`);
    return;
  }
  console.log(`✅ Python3 경로가 유효합니다: ${pythonPath}`);
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
const pythonPath = '/usr/bin/python3';

// 가상환경의 Python 인터프리터 경로 설정
const getVenvPythonPath = () => {
  const projectRoot = path.dirname(__dirname); // routes 폴더의 상위 디렉토리
  const venvPythonPath = path.join(projectRoot, 'AI', 'venv', 'bin', 'python3');
  
  // 가상환경 Python이 존재하는지 확인
  if (fs.existsSync(venvPythonPath)) {
    console.log(`✅ 가상환경 Python 경로 확인: ${venvPythonPath}`);
    return venvPythonPath;
  } else {
    console.warn(`⚠️ 가상환경 Python을 찾을 수 없습니다: ${venvPythonPath}`);
    console.warn(`⚠️ 시스템 Python3을 사용합니다.`);
    return 'python3'; // 기본값으로 시스템 Python 사용
  }
};

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

  const uploadInstance = new Upload({ client: s3Client, params: uploadParams });

  const result = await uploadInstance.done();
  return {
    location: result.Location,
    key: key,
    bucket: process.env.S3_BUCKET_NAME,
  };
}

// 이미지 다운로드 함수
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    // 요청 옵션에 헤더 추가
    const options = new URL(url);
    options.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    const request = protocol.get(options, (response) => {
      // 리다이렉트 처리
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(filepath, () => {});
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    });
    
    request.on('error', (err) => {
      file.close();
      fs.unlink(filepath, () => {});
      reject(new Error(`Network error: ${err.message}`));
    });
    
    file.on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(new Error(`File write error: ${err.message}`));
    });
  });
}

// Python OCR 스크립트 실행 함수 (URL 직접 처리 버전) - 수정된 버전
async function runOCRScriptWithURL(imageUrl) {
  return new Promise((resolve, reject) => {
    const pythonPath = getVenvPythonPath(); // 가상환경 Python 경로 사용
    const pythonScript = path.join(__dirname, '../AI/ocr_with_llm.py'); // 스크립트 경로 수정
    
    console.log(`🐍 Python 인터프리터: ${pythonPath}`);
    console.log(`📄 Python 스크립트: ${pythonScript}`);
    console.log(`🔗 이미지 URL: ${imageUrl}`);
    
    // 스크립트 파일 존재 확인
    if (!fs.existsSync(pythonScript)) {
      reject(new Error(`Python 스크립트를 찾을 수 없습니다: ${pythonScript}`));
      return;
    }
    
    const pythonProcess = spawn(pythonPath, [pythonScript, imageUrl], {
      env: {
        ...process.env,
        // Python 가상환경 관련 환경변수 설정
        VIRTUAL_ENV: path.join(path.dirname(__dirname), 'AI', 'venv'),
        PATH: `${path.join(path.dirname(__dirname), 'AI', 'venv', 'bin')}:${process.env.PATH}`
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`🐍 Python stderr: ${data.toString()}`); // 디버깅용
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`🐍 Python 프로세스 종료 코드: ${code}`);
      console.log(`📤 Python stdout: ${stdout}`);
      
      if (code !== 0) {
        console.error(`❌ Python 프로세스 오류: ${stderr}`);
        reject(new Error(`OCR 스크립트 실행 실패 (코드: ${code}): ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`✅ OCR 처리 완료:`, result);
        resolve(result);
      } catch (parseError) {
        console.error(`❌ JSON 파싱 실패: ${parseError.message}`);
        console.error(`📤 Raw stdout: ${stdout}`);
        reject(new Error(`OCR 결과 파싱 실패: ${parseError.message}, stdout: ${stdout}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 시작 오류: ${error.message}`);
      reject(new Error(`Python 프로세스 오류: ${error.message}`));
    });
  });
}

// Python OCR 스크립트 실행 함수 (로컬 파일 처리 버전) - 수정된 버전
async function runOCRScriptWithFile(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonPath = getVenvPythonPath(); // 가상환경 Python 경로 사용
    const pythonScript = path.join(__dirname, '../AI/ocr_with_llm.py'); // 스크립트 경로 수정
    
    console.log(`🐍 Python 인터프리터: ${pythonPath}`);
    console.log(`📄 Python 스크립트: ${pythonScript}`);
    console.log(`🖼️ 이미지 파일: ${imagePath}`);
    
    // 스크립트 파일 존재 확인
    if (!fs.existsSync(pythonScript)) {
      reject(new Error(`Python 스크립트를 찾을 수 없습니다: ${pythonScript}`));
      return;
    }
    
    // 이미지 파일 존재 확인
    if (!fs.existsSync(imagePath)) {
      reject(new Error(`이미지 파일을 찾을 수 없습니다: ${imagePath}`));
      return;
    }
    
    const pythonProcess = spawn(pythonPath, [pythonScript, imagePath], {
      env: {
        ...process.env,
        // Python 가상환경 관련 환경변수 설정
        VIRTUAL_ENV: path.join(path.dirname(__dirname), 'AI', 'venv'),
        PATH: `${path.join(path.dirname(__dirname), 'AI', 'venv', 'bin')}:${process.env.PATH}`
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`🐍 Python stderr: ${data.toString()}`); // 디버깅용
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`🐍 Python 프로세스 종료 코드: ${code}`);
      console.log(`📤 Python stdout: ${stdout}`);
      
      if (code !== 0) {
        console.error(`❌ Python 프로세스 오류: ${stderr}`);
        reject(new Error(`OCR 스크립트 실행 실패 (코드: ${code}): ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`✅ OCR 처리 완료:`, result);
        resolve(result);
      } catch (parseError) {
        console.error(`❌ JSON 파싱 실패: ${parseError.message}`);
        console.error(`📤 Raw stdout: ${stdout}`);
        reject(new Error(`OCR 결과 파싱 실패: ${parseError.message}, stdout: ${stdout}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 시작 오류: ${error.message}`);
      reject(new Error(`Python 프로세스 오류: ${error.message}`));
    });
  });
}


const cardRepository = new CardRepository(MysqlPoolProvider.getPool());
const questionRepository = new QuestionRepository(MysqlPoolProvider.getPool());
const snsRepository = new SnsRepository(MysqlPoolProvider.getPool());
const tagRepository = new TagRepository(MysqlPoolProvider.getPool());
const sharedCardRepository = new SharedCardRepository(
  MysqlPoolProvider.getPool()
);

// 명함 기본 정보 저장
router.post('/upload-basic', async (req, res) => {
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
  } = req.body;

  try {
    // user_id 필수 체크 및 유효성 검사
    if (!user_id || isNaN(parseInt(user_id))) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'user_id is required and must be a valid number'
      });
    }

    const card = {
      name: name ?? null,
      contact: contact ?? null,
      email: email ?? null,
      organization: organization ?? null,
      position: position ?? null,
      introduction: introduction ?? null,
      user_id: parseInt(user_id),
      _private: _private === 'true' || _private === true,
      card_image_url: card_image_url || null,
    };

    const cardResult = await cardRepository.insertCard(card);
    const cardId = cardResult.insertId;

    res
      .status(201)
      .json({
        success: true,
        data: { ...cardResult, id: cardId },
        message: 'Card basic info created successfully',
      });
  } catch (error) {
    console.error('Error inserting basic card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 기존 명함에 추가 정보 업데이트 (질문, SNS, 태그)
router.put('/:cardId/details', async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const {
    questions,
    sns_links,
    tags,
  } = req.body;

  const connection = await MysqlPoolProvider.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 기존 관련 데이터 삭제 (업데이트 방식)
    await questionRepository.deleteQuestionsByCardId(cardId);
    await snsRepository.deleteSnsByCardId(cardId);
    await tagRepository.removeAllCardTags(cardId);

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
          const tagId =
            tagResult.insertId ||
            (await tagRepository.getTagByName(tagName.trim())).id;
          await tagRepository.addCardTag(cardId, tagId);
        }
      }
    }

    await connection.commit();
    res
      .status(200)
      .json({ success: true, message: 'Card details updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating card details:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
    return res.status(400).json({ error: 'Name is required' });
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
          const tagId =
            tagResult.insertId ||
            (await tagRepository.getTagByName(tagName.trim())).id;
          await tagRepository.addCardTag(cardId, tagId);
        }
      }
    }

    await connection.commit();
    res
      .status(200)
      .json({ success: true, message: 'Card updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
      return res.status(404).json({ error: 'Card not found' });
    }

    await connection.commit();
    res
      .status(200)
      .json({ success: true, message: 'Card deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  } finally {
    connection.release();
  }
});

// OCR 처리 후 카드 업데이트 (개선된 버전) - 기존 코드에서 Python 경로만 수정
router.put('/ocr/:cardId', async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  let tempImagePath = null;
  const useDirectURL = req.body.useDirectURL !== false; // URL 직접 처리 옵션

  try {
    // 1. 카드 존재 확인 및 이미지 URL 가져오기
    const existingCard = await cardRepository.getCardById(cardId);
    if (!existingCard) {
      return res.status(404).json({ 
        error: 'Card not found',
        success: false 
      });
    }

    // 2. 카드 이미지 URL 확인
    if (!existingCard.card_image_url) {
      return res.status(400).json({ 
        error: 'No card image found for OCR processing',
        success: false 
      });
    }

    console.log(`🚀 카드 ${cardId} OCR 처리 시작, 이미지: ${existingCard.card_image_url}`);

    let ocrResult;

    if (useDirectURL) {
      // 3-A. URL 직접 처리 방식
      console.log(`🔗 URL 직접 처리 방식 사용: ${existingCard.card_image_url}`);
      ocrResult = await runOCRScriptWithURL(existingCard.card_image_url);
    } else {
      // 3-B. 파일 다운로드 후 처리 방식
      // 임시 디렉토리 생성
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 이미지 다운로드
      const urlParts = existingCard.card_image_url.split('?')[0];
      const imageExtension = path.extname(urlParts) || '.jpg';
      tempImagePath = path.join(tempDir, `card_${cardId}_${Date.now()}${imageExtension}`);
      
      console.log(`📥 이미지 다운로드 중: ${existingCard.card_image_url}`);
      await downloadImage(existingCard.card_image_url, tempImagePath);

      // OCR 처리
      console.log(`🔍 로컬 파일 OCR 처리: ${tempImagePath}`);
      ocrResult = await runOCRScriptWithFile(tempImagePath);
    }

    // 4. OCR 결과 확인
    if (!ocrResult.success) {
      return res.status(500).json({
        error: 'OCR processing failed',
        details: ocrResult.error,
        success: false
      });
    }

    // 5. 카드 정보 업데이트 준비
    const cardUpdateData = {
      name: ocrResult.name || existingCard.name,
      contact: ocrResult.contact || existingCard.contact,
      email: ocrResult.email || existingCard.email,
      organization: ocrResult.organization || existingCard.organization,
      position: ocrResult.position || existingCard.position,
      introduction: existingCard.introduction, // OCR로는 소개글을 추출하지 않음
      _private: existingCard.private, // 기존 설정 유지
      card_image_url: existingCard.card_image_url, // 기존 이미지 URL 유지
      profile_image_url: existingCard.profile_image_url // 기존 프로필 이미지 유지
    };

    // 6. 데이터베이스 업데이트
    const updateResult = await cardRepository.updateCard(cardId, cardUpdateData);
    
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Card not found during update',
        success: false 
      });
    }

    // 7. SNS 링크 처리 (OCR에서 SNS 정보가 추출된 경우)
    if (ocrResult.sns_links) {
      try {
        // 기존 SNS 링크 삭제
        await snsRepository.deleteSnsByCardId(cardId);
        
        // 새로운 SNS 링크 추가 (개선된 파싱)
        const snsText = ocrResult.sns_links.toString();
        const snsPatterns = [
          { platform: 'kakao', pattern: /(?:카카오톡?|KakaoTalk|카톡)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'instagram', pattern: /(?:인스타그램?|Instagram|인스타)\s*:?\s*@?([^\s,\n]+)/i },
          { platform: 'facebook', pattern: /(?:페이스북?|Facebook|fb)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'twitter', pattern: /(?:트위터?|Twitter|X)\s*:?\s*@?([^\s,\n]+)/i },
          { platform: 'linkedin', pattern: /(?:링크드인|LinkedIn)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'youtube', pattern: /(?:유튜브|YouTube)\s*:?\s*([^\s,\n]+)/i }
        ];

        for (const { platform, pattern } of snsPatterns) {
          const match = snsText.match(pattern);
          if (match && match[1]) {
            await snsRepository.insertSns({
              platform: platform,
              url: match[1].trim(),
              card_id: cardId
            });
            console.log(`✅ SNS 링크 추가됨: ${platform} - ${match[1]}`);
          }
        }
      } catch (snsError) {
        console.warn('⚠️ SNS 링크 처리 중 오류:', snsError);
        // SNS 처리 실패해도 메인 프로세스는 계속 진행
      }
    }

    // 8. 성공 응답
    res.status(200).json({
      success: true,
      message: 'Card updated successfully with OCR data',
      data: {
        cardId: cardId,
        extractedData: {
          name: ocrResult.name,
          contact: ocrResult.contact,
          email: ocrResult.email,
          organization: ocrResult.organization,
          position: ocrResult.position,
          sns_links: ocrResult.sns_links
        },
        updatedCard: cardUpdateData,
        processingMethod: useDirectURL ? 'direct_url' : 'file_download'
      }
    });

  } catch (error) {
    console.error('❌ OCR 처리 중 오류:', error);
    
    // 에러 타입별 응답
    if (error.message.includes('download')) {
      return res.status(400).json({
        error: 'Failed to download card image',
        details: error.message,
        success: false
      });
    } else if (error.message.includes('OCR') || error.message.includes('스크립트')) {
      return res.status(500).json({
        error: 'OCR processing failed',
        details: error.message,
        success: false
      });
    } else if (error.message.includes('파싱')) {
      return res.status(500).json({
        error: 'OCR result parsing failed',
        details: error.message,
        success: false
      });
    } else {
      return res.status(500).json({
        error: 'Internal server error during OCR processing',
        details: error.message,
        success: false
      });
    }
  } finally {
    // 9. 임시 파일 정리
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        fs.unlinkSync(tempImagePath);
        console.log(`🗑️ 임시 파일 삭제됨: ${tempImagePath}`);
      } catch (cleanupError) {
        console.warn('⚠️ 임시 파일 삭제 실패:', cleanupError);
      }
    }
  }
});

// 새로운 엔드포인트: 이미지 URL로 직접 OCR 처리 (테스트용) - 수정된 버전
router.post('/ocr-test', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({
      error: 'imageUrl is required',
      success: false
    });
  }

  try {
    console.log(`🧪 OCR 테스트 시작, URL: ${imageUrl}`);
    const ocrResult = await runOCRScriptWithURL(imageUrl);

    if (!ocrResult.success) {
      return res.status(500).json({
        error: 'OCR processing failed',
        details: ocrResult.error,
        success: false
      });
    }

    res.status(200).json({
      success: true,
      message: 'OCR test completed successfully',
      data: {
        extractedData: {
          name: ocrResult.name,
          contact: ocrResult.contact,
          email: ocrResult.email,
          organization: ocrResult.organization,
          position: ocrResult.position,
          sns_links: ocrResult.sns_links
        },
        extractedText: ocrResult.extracted_text // 디버깅용
      }
    });

  } catch (error) {
    console.error('❌ OCR 테스트 중 오류:', error);
    res.status(500).json({
      error: 'OCR test failed',
      details: error.message,
      success: false
    });
  }
});

// 카드 상세 조회 (질문, SNS, 태그 포함)
router.get('/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId);

    const card = await cardRepository.getCardById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const questions = await questionRepository.getQuestionsByCardId(cardId);
    const sns_links = await snsRepository.getSnsByCardId(cardId);
    const tags = await tagRepository.getTagsByCard(cardId);

    res
      .status(200)
      .json({ success: true, data: { ...card, questions, sns_links, tags } });
  } catch (error) {
    console.error('Error fetching card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
        const questions = await questionRepository.getQuestionsByCardId(
          card.id
        );
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);

        return { ...card, questions, sns_links, tags };
      })
    );

    res.status(200).json({ success: true, data: cardsWithDetails });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
        const questions = await questionRepository.getQuestionsByCardId(
          card.id
        );
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);

        return { ...card, questions, sns_links, tags };
      })
    );

    res.status(200).json({ success: true, data: cardsWithDetails });
  } catch (error) {
    console.error('Error fetching shared cards:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 카드 공유
router.post('/share', async (req, res) => {
  const { userId, cardId } = req.body;

  if (!userId || !cardId) {
    return res.status(400).json({ error: 'userId and cardId are required' });
  }

  try {
    // 이미 공유된 카드인지 확인
    const isShared = await sharedCardRepository.checkIfCardShared(
      userId,
      cardId
    );
    if (isShared) {
      return res
        .status(409)
        .json({ error: 'Card already shared with this user' });
    }

    await sharedCardRepository.shareCard(userId, cardId);
    res
      .status(201)
      .json({ success: true, message: 'Card shared successfully' });
  } catch (error) {
    console.error('Error sharing card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 공유 카드 삭제 (즐겨찾기 해제)
router.delete('/shared/:userId/:cardId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cardId = parseInt(req.params.cardId);

    const result = await sharedCardRepository.removeSharedCard(userId, cardId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Shared card not found' });
    }

    res
      .status(200)
      .json({ success: true, message: 'Shared card removed successfully' });
  } catch (error) {
    console.error('Error removing shared card:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 카드 링크 생성
router.post('/generate-link/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId);

    const shareToken = await cardRepository.generateCardLink(cardId);
    const shareUrl = `${req.protocol}://${req.get('host')}/card/shared-link/${shareToken}`;

    res
      .status(200)
      .json({
        success: true,
        data: { shareToken, shareUrl },
        message: 'Share link generated successfully',
      });
  } catch (error) {
    console.error('Error generating share link:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 공유 링크로 카드 조회
router.get('/shared-link/:shareToken', async (req, res) => {
  try {
    const shareToken = req.params.shareToken;

    const card = await cardRepository.getCardByShareToken(shareToken);
    if (!card) {
      return res.status(404).json({ error: 'Card not found or link expired' });
    }

    const questions = await questionRepository.getQuestionsByCardId(card.id);
    const sns_links = await snsRepository.getSnsByCardId(card.id);
    const tags = await tagRepository.getTagsByCard(card.id);

    res
      .status(200)
      .json({ success: true, data: { ...card, questions, sns_links, tags } });
  } catch (error) {
    console.error('Error fetching card by share link:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// 이미지 업로드 (프로필, 명함 사진)
router.post(
  '/upload-image',
  upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'card_image', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const result = {};

      if (files.profile_image) {
        const uploadResult = await uploadImageToS3(
          files.profile_image[0],
          'profile',
          req.body.id
        );
        result.profile_image_url = uploadResult.location;
      }

      if (files.card_image) {
        const uploadResult = await uploadImageToS3(
          files.card_image[0],
          'card',
          req.body.id
        );
        result.card_image_url = uploadResult.location;
      }

      res
        .status(200)
        .json({
          success: true,
          data: result,
          message: 'Images uploaded successfully',
        });
    } catch (error) {
      console.error('Error uploading images:', error);
      res
        .status(500)
        .json({ error: 'Internal server error', message: error.message });
    }
  }
);

// 태그별 카드 조회
router.get('/tag/:tagId/:userId', async (req, res) => {
  try {
    const tagId = parseInt(req.params.tagId);
    const userId = parseInt(req.params.userId);

    const cards = await tagRepository.getCardsByTag(tagId, userId);

    // 각 카드에 대한 추가 정보 조회
    const cardsWithDetails = await Promise.all(
      cards.map(async (card) => {
        const questions = await questionRepository.getQuestionsByCardId(
          card.id
        );
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);

        return { ...card, questions, sns_links, tags };
      })
    );

    res.status(200).json({ success: true, data: cardsWithDetails });
  } catch (error) {
    console.error('Error fetching cards by tag:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
        const questions = await questionRepository.getQuestionsByCardId(
          card.id
        );
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);

        return { ...card, questions, sns_links, tags };
      })
    );

    res.status(200).json({ success: true, data: cardsWithDetails });
  } catch (error) {
    console.error('Error fetching public cards:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
        const questions = await questionRepository.getQuestionsByCardId(
          card.id
        );
        const sns_links = await snsRepository.getSnsByCardId(card.id);
        const tags = await tagRepository.getTagsByCard(card.id);

        return { ...card, questions, sns_links, tags };
      })
    );

    res.status(200).json({ success: true, data: cardsWithDetails });
  } catch (error) {
    console.error('Error searching cards:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

export default router;
