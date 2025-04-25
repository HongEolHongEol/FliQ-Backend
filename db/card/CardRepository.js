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
      const query = `INSERT INTO Card (name, contact, email, profile_img_url, card_img_url, user_id, private) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const [result] = await connection.execute(query, [
        card.name,
        card.contact,
        card.email,
        card.profile_img_url,
        card.card_img_url,
        card.user_id,
        card.private,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }

  async getOwnCards(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Card WHERE user_id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }
}
