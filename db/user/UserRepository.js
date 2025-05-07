class UserRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async insertUser(user) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO User (name, email, password, profile_img_url) VALUES (?, ?, ?, ?)`;
      const [result] = await connection.execute(query, [
        user.name,
        user.email,
        user.password,
        user.profile_img_url,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }

  async getUserById(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM User WHERE id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      return rows[0]; // Return the first user found
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }

  async deleteUser(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM User WHERE id = ?`;
      const [result] = await connection.execute(query, [userId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err; // Rethrow the error for handling in the calling function
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }
  }
}

export default UserRepository;
