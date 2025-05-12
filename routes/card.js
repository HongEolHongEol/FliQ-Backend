import { Router } from 'express';
import CardRepository from '../db/card/CardRepository.js';
import MysqlPoolProvider from '../db/provider.js';
import Multer from 'multer';
import multerS3 from 'multer-s3';
import AWS from 'aws-sdk';

const router = Router();
const multer = Multer({
  storage: multerS3({
    s3: new AWS.S3(),
    bucket: () => process.env.S3_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      cb(null, `card/${req.body.id}`);
    },
  }),
});

const cardRepository = new CardRepository(MysqlPoolProvider.getPool());

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
  } = req.body;

  try {
    const card = {
      name,
      contact,
      email,
      organization,
      position,
      introduction,
      user_id,
      _private,
    };

    const result = await cardRepository.insertCard(card);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error inserting card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload_image', multer.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.status(200).json({ error: null });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
