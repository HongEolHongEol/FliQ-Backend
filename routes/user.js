import { Router } from 'express';
import UserRepository from '../db/user/UserRepository.js';
import MysqlPoolProvider from '../db/provider.js';

const router = Router();

const userRepository = new UserRepository(MysqlPoolProvider.getPool());

// 사용자 생성
router.post('/upload', async (req, res) => {
  const { id, name, email, profileImageURL } = req.body;
  console.log(req.body);

  // 필수 필드 검증
  if (!id || !name) {
    return res.status(400).json({ 
      error: 'Id, Name are required fields' 
    });
  }

  // 이메일 형식 검증
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // if (!emailRegex.test(email)) {
  //   return res.status(400).json({ 
  //     error: 'Invalid email format' 
  //   });
  // }

  try {
    const user = {
      id,
      name,
      email,
      profile_img_url: profileImageURL || null,
    };

    const result = await userRepository.insertUser(user);
    res.status(201).json({ 
      success: true, 
      data: id,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error inserting user:', error);
    
    // 중복 이메일 에러 처리
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'Email already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 사용자 조회
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await userRepository.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    console.log(user);
    
    res.status(200).json({ 
      ...user,
      profileImageURL: user.profile_img_url
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 사용자 삭제
router.delete('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await userRepository.deleteUser(userId);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;
