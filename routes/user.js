import { Router } from 'express';
import UserRepository from '../db/user/UserRepository.js';
import MysqlPoolProvider from '../db/provider.js';

const router = Router();

const userRepository = new UserRepository(MysqlPoolProvider.getPool());

router.post('/upload', async (req, res) => {
  const { name, email, profile_img_url } = req.body;

  try {
    const user = {
      name,
      email,
      profile_img_url,
    };

    const result = await userRepository.insertUser(user);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});