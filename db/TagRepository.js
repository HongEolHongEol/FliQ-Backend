class TagRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async insertTag(tagName) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO Tag (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`;
      const [result] = await connection.execute(query, [tagName]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getTagByName(tagName) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Tag WHERE name = ?`;
      const [rows] = await connection.execute(query, [tagName]);
      return rows[0];
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getAllTags() {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Tag ORDER BY name`;
      const [rows] = await connection.execute(query);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async addCardTag(cardId, tagId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO Card_tag (card_id, tag_id) VALUES (?, ?)`;
      const [result] = await connection.execute(query, [cardId, tagId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async removeCardTag(cardId, tagId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Card_tag WHERE card_id = ? AND tag_id = ?`;
      const [result] = await connection.execute(query, [cardId, tagId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getCardsByTag(tagId, userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `
        SELECT DISTINCT Card.* 
        FROM Card 
        JOIN Card_tag ON Card.id = Card_tag.card_id 
        WHERE Card_tag.tag_id = ? 
        AND (Card.user_id = ? OR Card.private = 0 OR Card.id IN (
          SELECT card_id FROM Shared_card WHERE user_id = ?
        ))
      `;
      const [rows] = await connection.execute(query, [tagId, userId, userId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getTagsByCard(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `
        SELECT Tag.* 
        FROM Tag 
        JOIN Card_tag ON Tag.id = Card_tag.tag_id 
        WHERE Card_tag.card_id = ?
      `;
      const [rows] = await connection.execute(query, [cardId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async removeAllCardTags(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Card_tag WHERE card_id = ?`;
      const [result] = await connection.execute(query, [cardId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }
}

export default TagRepository;