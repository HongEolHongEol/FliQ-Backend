import dotenv from 'dotenv';
import AWS from 'aws-sdk';

import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import indexRouter from './routes/index.js';
import cardRouter from './routes/card.js';
import userRouter from './routes/user.js';
import MysqlPoolProvider from './db/provider.js';

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ES 모듈에서 __dirname 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.development' });
} else {
  dotenv.config({ path: '.env.production' });
}

AWS.config.update({
  region: process.env.AWS_REGION,
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 수정된 미들웨어 - next()를 호출해야 다음 미들웨어로 넘어갑니다
app.use((req, res, next) => {
  // MySQL 연결 테스트 (한 번만 실행하도록 개선)
  if (!app.locals.mysqlTested) {
    const pool = MysqlPoolProvider.getPool();
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting MySQL connection:', err);
      } else {
        console.log('MySQL connection established');
        connection.release();
      }
    });
    app.locals.mysqlTested = true;
  }

  // Multer로 받은 파일 임시 저장소 생성
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 중요: next()를 호출해야 다음 미들웨어/라우터로 진행됩니다
  next();
});

// 라우터 등록
app.use('/', indexRouter);
app.use('/card', cardRouter);
app.use('/user', userRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({ 
    error: res.locals.message,
    status: err.status || 500
  });
});

const port = process.env.PORT || 3000;
app.set('port', port);

if (process.env.NODE_ENV === 'development') {
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`Development server running on http://localhost:${port}`);
  });
} else {
  const options = {}; // TODO: https options
  const server = https.createServer(options, app);
  server.listen(port, () => {
    console.log(`Production server running on https://localhost:${port}`);
  });
}