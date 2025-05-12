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
      const query = `INSERT INTO Card (name, contact, email, organization, position, introduction, user_id, private) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const [result] = await connection.execute(query, [
        card.name,
        card.contact,
        card.email,
        card.organization,
        card.position,
        card.introduction,
        card.user_id,
        +card._private,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
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
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }

  async getAllSharedCardsByUser(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT Card.* FROM Shared_card JOIN Card On Card.id = Shared_card.card_id WHERE Shared_card.user_id = ?`;
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

export default CardRepository;
