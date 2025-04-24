class CardRepository {

  /**
   * @param {import("mysql2").Pool} pool 
   */
  constructor(pool) {
    this.pool = pool;
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