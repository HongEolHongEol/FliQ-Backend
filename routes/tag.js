import { Router } from 'express';
import TagRepository from '../db/tag/TagRepository.js';
import MysqlPoolProvider from '../db/provider.js';

const router = Router();
const tagRepository = new TagRepository(MysqlPoolProvider.getPool());

// 모든 태그 조회
router.get('/', async (req, res) => {
  try {
    const tags = await tagRepository.getAllTags();
    res.status(200).json({ 
      success: true, 
      data: tags 
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 태그 생성
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ 
      error: 'Tag name is required' 
    });
  }

  try {
    const result = await tagRepository.insertTag(name.trim());
    res.status(201).json({ 
      success: true, 
      data: result,
      message: 'Tag created successfully'
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 특정 태그 조회
router.get('/:tagName', async (req, res) => {
  try {
    const tagName = req.params.tagName;
    const tag = await tagRepository.getTagByName(tagName);
    
    if (!tag) {
      return res.status(404).json({ 
        error: 'Tag not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: tag 
    });
  } catch (error) {
    console.error('Error fetching tag:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;