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

  // 프로필 이미지 URL 업데이트
  async updateProfileImage(userId, profileImageUrl) {
    const connection = await this.pool.getConnection();
    try {
      const query = `
        UPDATE User 
        SET profile_img_url = ? 
        WHERE id = ?
      `;
      const [result] = await connection.execute(query, [profileImageUrl, userId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  // 전체 사용자 정보 업데이트 (추가 유틸리티 메서드)
  async updateUser(userId, updateData) {
    const connection = await this.pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
      if (updateData.name !== undefined) {
        fields.push('name = ?');
        values.push(updateData.name);
      }
      if (updateData.email !== undefined) {
        fields.push('email = ?');
        values.push(updateData.email);
      }
      if (updateData.profile_img_url !== undefined) {
        fields.push('profile_img_url = ?');
        values.push(updateData.profile_img_url);
      }
      
      if (fields.length === 0) {
        throw new Error('No fields to update');
      }
      
      values.push(userId);
      
      const query = `
        UPDATE User 
        SET ${fields.join(', ')} 
        WHERE id = ?
      `;
      
      const [result] = await connection.execute(query, values);
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