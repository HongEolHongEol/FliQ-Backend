class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async insertUser(user) {
    const connection = await this.pool.getConnection();
    try {
      const query = `
        INSERT INTO User (id, name, email, profile_img_url) 
        VALUES (?, ?, ?, ?)
      `;
      const [result] = await connection.execute(query, [
        user.id,
        user.name,
        user.email,
        user.profile_img_url,
      ]);
      return { id: result.insertId, ...result };
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getUserById(userId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM User WHERE id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      return rows[0];
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getUserByEmail(email) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM User WHERE email = ?`;
      const [rows] = await connection.execute(query, [email]);
      return rows[0];
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
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
      throw err;
    } finally {
      connection.release();
    }
  }
}

export default UserRepository;
