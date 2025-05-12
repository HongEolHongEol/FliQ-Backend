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

const app = express();

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

app.use(() => {
  // Mysql 연결 테스트
  const pool = MysqlPoolProvider.getPool();
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection:', err);
    } else {
      console.log('MySQL connection established');
      connection.release();
    }
  });

  // Multer로 받은 파일 임시 저장소
  if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
  }
});

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
});

const port = 3000;
app.set('port', port);

if (process.env.NODE_ENV === 'development') {
  http.createServer(app).listen(port);
} else {
  const options = {}; // TODO: https options
  https.createServer(options, app).listen(port);
}
