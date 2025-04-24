import dotenv from 'dotenv';

import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import indexRouter from './routes/index.js';
import MySQLPoolProvider from './db/mysql.js';

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

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);

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

const port = process.env.PORT || '80';
app.set('port', port);

if (process.env.NODE_ENV === 'development') {
  const pool = MySQLPoolProvider.getPool();
  http.createServer(app).listen(port);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return;
    }
    console.log('Connected to the database');
    connection.release();
  });

} else {
  const options = {}; // TODO: https options
  https.createServer(options, app).listen(port);
}
