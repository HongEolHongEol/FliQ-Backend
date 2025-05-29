class SnsRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async insertSns(sns) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO SNS (platform, url, card_id) VALUES (?, ?, ?)`;
      const [result] = await connection.execute(query, [
        sns.platform,
        sns.url,
        sns.card_id,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getSnsByCardId(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM SNS WHERE card_id = ?`;
      const [rows] = await connection.execute(query, [cardId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async updateSns(snsId, sns) {
    const connection = await this.pool.getConnection();
    try {
      const query = `UPDATE SNS SET platform = ?, url = ? WHERE id = ?`;
      const [result] = await connection.execute(query, [
        sns.platform,
        sns.url,
        snsId,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteSns(snsId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM SNS WHERE id = ?`;
      const [result] = await connection.execute(query, [snsId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteSnsByCardId(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM SNS WHERE card_id = ?`;
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

export default SnsRepository;