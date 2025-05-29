import dotenv from 'dotenv';
import AWS from 'aws-sdk';

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

// CORS 설정 추가
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

app.use((req, res, next) => {
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

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.json({ 
    error: res.locals.message,
    status: err.status || 500
  });
});

const port = process.env.PORT || 3000;
app.set('port', port);

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Development server running on http://localhost:${port}`);
});

// HTTPS 설정 (SSL 인증서 필요)
// Uncomment the following lines to enable HTTPS in production
// const options = {}; // TODO: https options
//   const server = https.createServer(options, app);
//   server.listen(port, () => {
//     console.log(`Production server running on https://localhost:${port}`);
//   });

export default app;