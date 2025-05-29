class CardRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async insertCard(card) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO Card (name, contact, email, organization, position, introduction, user_id, private, card_image_url, profile_image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const [result] = await connection.execute(query, [
        card.name,
        card.contact,
        card.email,
        card.organization,
        card.position,
        card.introduction,
        card.user_id,
        +card._private,
        card.card_image_url || null,
        card.profile_image_url || null,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async updateCard(cardId, card) {
    const connection = await this.pool.getConnection();
    try {
      const query = `UPDATE Card SET name = ?, contact = ?, email = ?, organization = ?, position = ?, introduction = ?, private = ?, card_image_url = ?, profile_image_url = ? WHERE id = ?`;
      const [result] = await connection.execute(query, [
        card.name,
        card.contact,
        card.email,
        card.organization,
        card.position,
        card.introduction,
        +card._private,
        card.card_image_url,
        card.profile_image_url,
        cardId,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteCard(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Card WHERE id = ?`;
      const [result] = await connection.execute(query, [cardId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getCardById(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Card WHERE id = ?`;
      const [rows] = await connection.execute(query, [cardId]);
      return rows[0];
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getAllCardsByUser(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Card WHERE user_id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getAllSharedCardsByUser(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT Card.*, User.name as owner_name FROM Shared_card JOIN Card On Card.id = Shared_card.card_id JOIN User ON User.id = Card.user_id WHERE Shared_card.user_id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getPublicCards(userId = null) {
    const connection = await this.pool.getConnection();
    try {
      let query = `SELECT Card.*, User.name as owner_name FROM Card JOIN User ON User.id = Card.user_id WHERE Card.private = 0`;
      let params = [];
      
      if (userId) {
        query += ` AND Card.user_id != ?`;
        params.push(userId);
      }
      
      query += ` ORDER BY Card.id DESC`;
      
      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async searchCards(searchTerm, userId = null) {
    const connection = await this.pool.getConnection();
    try {
      let query = `
        SELECT Card.*, User.name as owner_name 
        FROM Card 
        JOIN User ON User.id = Card.user_id 
        WHERE (Card.private = 0 OR Card.user_id = ? OR Card.id IN (
          SELECT card_id FROM Shared_card WHERE user_id = ?
        ))
        AND (Card.name LIKE ? OR Card.organization LIKE ? OR Card.position LIKE ?)
        ORDER BY Card.id DESC
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const params = [userId, userId, searchPattern, searchPattern, searchPattern];
      
      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async generateCardLink(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const shareToken = this.generateShareToken();
      const query = `UPDATE Card SET share_token = ? WHERE id = ?`;
      await connection.execute(query, [shareToken, cardId]);
      return shareToken;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getCardByShareToken(shareToken) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT Card.*, User.name as owner_name FROM Card JOIN User ON User.id = Card.user_id WHERE Card.share_token = ?`;
      const [rows] = await connection.execute(query, [shareToken]);
      return rows[0];
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  generateShareToken() {
    return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  }
}

export default CardRepository;