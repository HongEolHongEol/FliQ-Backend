import dotenv from 'dotenv';
import { S3Client } from '@aws-sdk/client-s3';

import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import indexRouter from './routes/index.js';
import cardRouter from './routes/card.js';
import userRouter from './routes/user.js';
import tagRouter from './routes/tag.js';
import fileRouter from './routes/file.js';
import MysqlPoolProvider from './db/provider.js';

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment 설정
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.development' });
} else {
  dotenv.config({ path: '.env.production' });
}

// AWS S3 클라이언트 설정 (AWS SDK v3 방식)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// MySQL 연결 테스트 및 초기화 미들웨어
app.use(async (req, res, next) => {
  if (!app.locals.mysqlTested) {
    try {
      const pool = MysqlPoolProvider.getPool();
      const connection = await pool.getConnection();
      console.log('MySQL connection established successfully');
      connection.release();
      app.locals.mysqlTested = true;
    } catch (err) {
      console.error('Error establishing MySQL connection:', err);
      // 연결 실패해도 서버는 계속 실행되도록 함
    }
  }

  // uploads 디렉토리 생성 (로컬 테스트용)
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  next();
});

// 라우터 설정
app.use('/', indexRouter);
app.use('/card', cardRouter);
app.use('/user', userRouter);
app.use('/tag', tagRouter);
app.use('/file', fileRouter);

// 404 에러 핸들러
app.use(function (req, res, next) {
  next(createError(404));
});

// 전역 에러 핸들러
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.error('Global error handler:', err);

  res.status(err.status || 500);
  res.json({ 
    error: res.locals.message,
    status: err.status || 500
  });
});

const port = process.env.PORT || 3000;
app.set('port', port);

// HTTP 서버 생성 및 시작
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'not configured'}`);
  console.log(`S3 Bucket: ${process.env.S3_BUCKET_NAME || 'not configured'}`);
});

// Graceful shutdown 처리
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    console.log('HTTP server closed');
    try {
      await MysqlPoolProvider.closePool();
      console.log('MySQL pool closed');
    } catch (err) {
      console.error('Error closing MySQL pool:', err);
    }
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    console.log('HTTP server closed');
    try {
      await MysqlPoolProvider.closePool();
      console.log('MySQL pool closed');
    } catch (err) {
      console.error('Error closing MySQL pool:', err);
    }
    process.exit(0);
  });
});

// HTTPS 설정 (프로덕션 환경에서 필요시 사용)
if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    
    const httpsServer = https.createServer(options, app);
    const httpsPort = process.env.HTTPS_PORT || 443;
    
    httpsServer.listen(httpsPort, () => {
      console.log(`HTTPS server running on https://localhost:${httpsPort}`);
    });
  } catch (err) {
    console.error('Failed to start HTTPS server:', err);
  }
}

export default app;
