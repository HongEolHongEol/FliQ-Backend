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
// 이미지 다운로드 함수 (개선된 버전)
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 이미지 다운로드 시작: ${url}`);
    
    // URL 유효성 검사
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return reject(new Error(`Invalid URL: ${url}`));
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    // 디렉토리 확인 및 생성
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 디렉토리 생성: ${dir}`);
    }
    
    const file = fs.createWriteStream(filepath);
    let fileSize = 0;
    let downloadStartTime = Date.now();
    
    // 요청 옵션 설정 (개선된 헤더)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/jpeg,image/png,image/*,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': url // 일부 서버에서 요구할 수 있음
      },
      timeout: 30000 // 30초 타임아웃
    };
    
    // 리다이렉트 카운터 추가 (무한 리다이렉트 방지)
    let redirectCount = 0;
    const maxRedirects = 5;
    
    const makeRequest = (requestUrl, redirects = 0) => {
      if (redirects > maxRedirects) {
        file.close();
        fs.unlink(filepath, () => {});
        return reject(new Error(`Too many redirects (${redirects})`));
      }
      
      const currentUrl = new URL(requestUrl);
      const currentProtocol = currentUrl.protocol === 'https:' ? https : http;
      const currentOptions = {
        ...options,
        hostname: currentUrl.hostname,
        port: currentUrl.port,
        path: currentUrl.pathname + currentUrl.search
      };
      
      const request = currentProtocol.request(currentOptions, (response) => {
        console.log(`📡 응답 상태: ${response.statusCode} ${response.statusMessage}`);
        console.log(`📋 Content-Type: ${response.headers['content-type']}`);
        console.log(`📊 Content-Length: ${response.headers['content-length']}`);
        
        // 리다이렉트 처리
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          console.log(`🔄 리다이렉트 ${redirects + 1}/${maxRedirects}: ${redirectUrl}`);
          
          const newUrl = redirectUrl.startsWith('http') 
            ? redirectUrl 
            : new URL(redirectUrl, requestUrl).href;
            
          return makeRequest(newUrl, redirects + 1);
        }
        
        // HTTP 오류 상태 처리
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(filepath, () => {});
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for URL: ${requestUrl}`));
        }
        
        // Content-Type 검증 (경고만 출력)
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.startsWith('image/')) {
          console.warn(`⚠️ 예상치 못한 Content-Type: ${contentType}`);
        }
        
        // 파일 크기 제한 체크
        const maxSize = 50 * 1024 * 1024; // 50MB
        const contentLength = parseInt(response.headers['content-length']) || 0;
        if (contentLength > maxSize) {
          file.close();
          fs.unlink(filepath, () => {});
          return reject(new Error(`File too large: ${contentLength} bytes (max: ${maxSize} bytes)`));
        }
        
        // 응답 데이터 처리
        response.on('data', (chunk) => {
          fileSize += chunk.length;
          if (fileSize > maxSize) {
            file.close();
            fs.unlink(filepath, () => {});
            return reject(new Error(`File too large during download: ${fileSize} bytes`));
          }
        });
        
        // 응답을 파일로 파이프
        response.pipe(file);
        
        // 다운로드 완료 처리
        file.on('finish', () => {
          file.close();
          const downloadTime = Date.now() - downloadStartTime;
          console.log(`✅ 다운로드 완료: ${filepath}`);
          console.log(`📊 파일 크기: ${fileSize} bytes`);
          console.log(`⏱️ 다운로드 시간: ${downloadTime}ms`);
          
          // 파일 유효성 검사
          if (fileSize === 0) {
            fs.unlink(filepath, () => {});
            return reject(new Error('Downloaded file is empty'));
          }
          
          if (!fs.existsSync(filepath)) {
            return reject(new Error('Downloaded file does not exist'));
          }
          
          resolve(filepath);
        });
      });
      
      // 요청 타임아웃 설정
      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error('Request timeout after 30 seconds'));
      });
      
      // 요청 에러 처리
      request.on('error', (err) => {
        file.close();
        fs.unlink(filepath, () => {});
        console.error(`❌ 요청 오류: ${err.message}`);
        reject(new Error(`Network error: ${err.message}`));
      });
      
      // 요청 시작
      request.end();
    };
    
    // 파일 쓰기 에러 처리
    file.on('error', (err) => {
      fs.unlink(filepath, () => {});
      console.error(`❌ 파일 쓰기 오류: ${err.message}`);
      reject(new Error(`File write error: ${err.message}`));
    });
    
    // 첫 번째 요청 시작
    makeRequest(url);
  });
}

// Python OCR 스크립트 실행 함수 (로컬 파일 처리)
async function runOCRScriptWithFile(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonPath = getVenvPythonPath();
    const pythonScript = path.join(__dirname, '../AI/ocr_with_llm.py');
    
    console.log(`🐍 Python 인터프리터: ${pythonPath}`);
    console.log(`📄 Python 스크립트: ${pythonScript}`);
    console.log(`🖼️ 이미지 파일: ${imagePath}`);
    
    // 사전 검증
    if (!fs.existsSync(pythonPath)) {
      reject(new Error(`Python 인터프리터를 찾을 수 없습니다: ${pythonPath}`));
      return;
    }
    
    if (!fs.existsSync(pythonScript)) {
      reject(new Error(`Python 스크립트를 찾을 수 없습니다: ${pythonScript}`));
      return;
    }
    
    if (!fs.existsSync(imagePath)) {
      reject(new Error(`이미지 파일을 찾을 수 없습니다: ${imagePath}`));
      return;
    }
    
    // 환경변수 설정
    const venvPath = path.join(path.dirname(__dirname), 'AI', 'venv');
    const isWindows = process.platform === 'win32';
    const envPath = isWindows 
      ? `${path.join(venvPath, 'Scripts')};${process.env.PATH}`
      : `${path.join(venvPath, 'bin')}:${process.env.PATH}`;
    
    const pythonProcess = spawn(pythonPath, [pythonScript, imagePath], {
      env: {
        ...process.env,
        VIRTUAL_ENV: venvPath,
        PATH: envPath,
        PYTHONPATH: path.join(path.dirname(__dirname), 'AI') // Python 모듈 경로 추가
      },
      stdio: ['pipe', 'pipe', 'pipe'] // 명시적으로 stdio 설정
    });
    
    let stdout = '';
    let stderr = '';
    let isResolved = false;
    
    // 표준 출력 처리
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // 표준 에러 처리 (로그용)
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`🐍 Python stderr: ${data.toString().trim()}`);
    });
    
    // 프로세스 종료 처리
    pythonProcess.on('close', (code) => {
      if (isResolved) return; // 중복 처리 방지
      isResolved = true;
      
      console.log(`🐍 Python 프로세스 종료 코드: ${code}`);
      console.log(`📤 Python stdout length: ${stdout.length}`);
      console.log(`📤 Python stderr length: ${stderr.length}`);
      
      if (code !== 0) {
        console.error(`❌ Python 프로세스 오류 (코드: ${code}):`, stderr);
        reject(new Error(`OCR 스크립트 실행 실패 (코드: ${code}): ${stderr || 'Unknown error'}`));
        return;
      }
      
      if (!stdout.trim()) {
        reject(new Error('OCR 스크립트에서 출력이 없습니다'));
        return;
      }
      
      try {
        // JSON 파싱 시도
        const result = JSON.parse(stdout.trim());
        console.log(`✅ OCR 처리 완료:`, {
          success: result.success,
          hasName: !!result.name,
          hasContact: !!result.contact,
          hasEmail: !!result.email,
          hasOrganization: !!result.organization
        });
        resolve(result);
      } catch (parseError) {
        console.error(`❌ JSON 파싱 실패: ${parseError.message}`);
        console.error(`📤 Raw stdout: ${stdout.substring(0, 500)}...`);
        reject(new Error(`OCR 결과 파싱 실패: ${parseError.message}`));
      }
    });
    
    // 프로세스 에러 처리
    pythonProcess.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;
      
      console.error(`❌ Python 프로세스 시작 오류: ${error.message}`);
      reject(new Error(`Python 프로세스 오류: ${error.message}`));
    });
    
    // 프로세스 타임아웃 설정 (2분)
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        pythonProcess.kill('SIGTERM');
        reject(new Error('OCR 처리 타임아웃 (2분)'));
      }
    }, 120000);
    
    // 프로세스가 끝나면 타임아웃 해제
    pythonProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// 이미지 URL에서 적절한 파일 확장자 추출
function getImageExtension(url, contentType = null) {
  // Content-Type에서 확장자 추출 시도
  if (contentType) {
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff'
    };
    
    const ext = typeMap[contentType.toLowerCase()];
    if (ext) return ext;
  }
  
  // URL에서 확장자 추출
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext)) {
      return ext;
    }
  } catch (e) {
    // URL 파싱 실패 시 무시
  }
  
  // 기본값
  return '.jpg';
}

// 임시 파일 정리 함수
function cleanupTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ 임시 파일 삭제됨: ${filePath}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ 임시 파일 삭제 실패: ${filePath}`, error.message);
      return false;
    }
  }
  return false;
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

// OCR 처리 후 카드 업데이트 라우터 (개선된 버전)
router.put('/ocr/:cardId', async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  let tempImagePath = null;
  const startTime = Date.now();

  try {
    console.log(`🚀 카드 ${cardId} OCR 처리 시작`);

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

    console.log(`📸 처리할 이미지: ${existingCard.card_image_url}`);

    // 3. 임시 디렉토리 생성
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`📁 임시 디렉토리 생성: ${tempDir}`);
    }

    // 4. 임시 파일 경로 생성 (타임스탬프와 랜덤값으로 중복 방지)
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const imageExtension = getImageExtension(existingCard.card_image_url);
    tempImagePath = path.join(tempDir, `card_${cardId}_${timestamp}_${randomSuffix}${imageExtension}`);
    
    console.log(`📁 임시 파일 경로: ${tempImagePath}`);

    // 5. 이미지 다운로드
    console.log(`📥 이미지 다운로드 시작...`);
    await downloadImage(existingCard.card_image_url, tempImagePath);
    
    // 다운로드된 파일 정보 확인
    const fileStats = fs.statSync(tempImagePath);
    console.log(`📊 다운로드 완료 - 파일 크기: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error('다운로드된 파일이 비어있습니다');
    }

    // 6. OCR 처리
    console.log(`🔍 OCR 처리 시작...`);
    const ocrResult = await runOCRScriptWithFile(tempImagePath);

    // 7. OCR 결과 검증
    if (!ocrResult.success) {
      throw new Error(`OCR 처리 실패: ${ocrResult.error || 'Unknown error'}`);
    }

    console.log(`✅ OCR 처리 완료 - 추출된 정보:`, {
      name: !!ocrResult.name,
      contact: !!ocrResult.contact,
      email: !!ocrResult.email,
      organization: !!ocrResult.organization,
      position: !!ocrResult.position,
      sns_links: !!ocrResult.sns_links
    });

    // 8. 카드 정보 업데이트 준비 (null 값 필터링)
    const cardUpdateData = {
      name: ocrResult.name || existingCard.name,
      contact: ocrResult.contact || existingCard.contact,
      email: ocrResult.email || existingCard.email,
      organization: ocrResult.organization || existingCard.organization,
      position: ocrResult.position || existingCard.position,
      introduction: existingCard.introduction, // 기존 소개글 유지
      _private: existingCard.private, // 기존 프라이버시 설정 유지
      card_image_url: existingCard.card_image_url, // 기존 이미지 URL 유지
      profile_image_url: existingCard.profile_image_url // 기존 프로필 이미지 유지
    };

    // 9. 데이터베이스 업데이트
    console.log(`💾 카드 정보 업데이트 중...`);
    const updateResult = await cardRepository.updateCard(cardId, cardUpdateData);
    
    if (updateResult.affectedRows === 0) {
      throw new Error('카드 업데이트 실패 - 카드를 찾을 수 없습니다');
    }

    console.log(`✅ 카드 기본 정보 업데이트 완료`);

    // 10. SNS 링크 처리 (옵션)
    let snsProcessed = 0;
    if (ocrResult.sns_links) {
      try {
        console.log(`🔗 SNS 링크 처리 시작...`);
        
        // 기존 SNS 링크 삭제
        await snsRepository.deleteSnsByCardId(cardId);
        
        // SNS 정보 파싱 및 저장
        const snsText = String(ocrResult.sns_links);
        const snsPatterns = [
          { platform: 'kakao', pattern: /(?:카카오톡?|KakaoTalk|카톡|kakao)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'instagram', pattern: /(?:인스타그램?|Instagram|인스타|@)\s*:?\s*@?([^\s,\n]+)/i },
          { platform: 'facebook', pattern: /(?:페이스북?|Facebook|fb)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'twitter', pattern: /(?:트위터?|Twitter|X)\s*:?\s*@?([^\s,\n]+)/i },
          { platform: 'linkedin', pattern: /(?:링크드인|LinkedIn)\s*:?\s*([^\s,\n]+)/i },
          { platform: 'youtube', pattern: /(?:유튜브|YouTube)\s*:?\s*([^\s,\n]+)/i }
        ];

        for (const { platform, pattern } of snsPatterns) {
          const match = snsText.match(pattern);
          if (match && match[1] && match[1].trim().length > 0) {
            const snsUrl = match[1].trim();
            await snsRepository.insertSns({
              platform: platform,
              url: snsUrl,
              card_id: cardId
            });
            console.log(`✅ SNS 링크 추가: ${platform} - ${snsUrl}`);
            snsProcessed++;
          }
        }
        
        console.log(`✅ SNS 링크 처리 완료: ${snsProcessed}개 추가`);
      } catch (snsError) {
        console.warn('⚠️ SNS 링크 처리 중 오류 (메인 프로세스는 계속):', snsError.message);
      }
    }

    // 11. 처리 시간 계산
    const processingTime = Date.now() - startTime;
    console.log(`🎉 전체 OCR 처리 완료 - 소요시간: ${processingTime}ms`);

    // 12. 성공 응답
    res.status(200).json({
      success: true,
      message: 'Card updated successfully with OCR data',
      data: {
        cardId: cardId,
        processingTimeMs: processingTime,
        extractedData: {
          name: ocrResult.name,
          contact: ocrResult.contact,
          email: ocrResult.email,
          organization: ocrResult.organization,
          position: ocrResult.position,
          sns_links: ocrResult.sns_links
        },
        updatedFields: {
          name: !!ocrResult.name,
          contact: !!ocrResult.contact,
          email: !!ocrResult.email,
          organization: !!ocrResult.organization,
          position: !!ocrResult.position
        },
        snsLinksProcessed: snsProcessed,
        processingMethod: 'local_file_download'
      }
    });

  } catch (error) {
    console.error('❌ OCR 처리 중 오류:', error);
    
    // 에러 타입별 상세 응답
    let statusCode = 500;
    let errorType = 'internal_error';
    
    if (error.message.includes('download') || error.message.includes('Network')) {
      statusCode = 400;
      errorType = 'download_error';
    } else if (error.message.includes('OCR') || error.message.includes('Python')) {
      statusCode = 500;
      errorType = 'ocr_processing_error';
    } else if (error.message.includes('파싱') || error.message.includes('JSON')) {
      statusCode = 500;
      errorType = 'result_parsing_error';
    } else if (error.message.includes('timeout') || error.message.includes('타임아웃')) {
      statusCode = 408;
      errorType = 'timeout_error';
    }
    
    return res.status(statusCode).json({
      success: false,
      error: error.message,
      errorType: errorType,
      cardId: cardId,
      processingTimeMs: Date.now() - startTime
    });
    
  } finally {
    // 13. 임시 파일 정리 (항상 실행)
    if (tempImagePath) {
      setTimeout(() => {
        cleanupTempFile(tempImagePath);
      }, 1000); // 1초 후 정리 (응답 완료 후)
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
