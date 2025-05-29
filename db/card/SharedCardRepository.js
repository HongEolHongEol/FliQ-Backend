class SharedCardRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async shareCard(userId, cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO Shared_card (user_id, card_id) VALUES (?, ?)`;
      const [result] = await connection.execute(query, [userId, cardId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async removeSharedCard(userId, cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Shared_card WHERE user_id = ? AND card_id = ?`;
      const [result] = await connection.execute(query, [userId, cardId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getSharedCardsByUser(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `
        SELECT Card.*, User.name as owner_name, User.profile_img_url as owner_profile 
        FROM Shared_card 
        JOIN Card ON Card.id = Shared_card.card_id 
        JOIN User ON User.id = Card.user_id 
        WHERE Shared_card.user_id = ?
      `;
      const [rows] = await connection.execute(query, [userId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async checkIfCardShared(userId, cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Shared_card WHERE user_id = ? AND card_id = ?`;
      const [rows] = await connection.execute(query, [userId, cardId]);
      return rows.length > 0;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }
}

export default SharedCardRepository;