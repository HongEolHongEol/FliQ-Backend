class QuestionRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async insertQuestion(question) {
    const connection = await this.pool.getConnection();
    try {
      const query = `INSERT INTO Question (question, answer, card_id) VALUES (?, ?, ?)`;
      const [result] = await connection.execute(query, [
        question.question,
        question.answer,
        question.card_id,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async getQuestionsByCardId(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `SELECT * FROM Question WHERE card_id = ?`;
      const [rows] = await connection.execute(query, [cardId]);
      return rows;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async updateQuestion(questionId, question) {
    const connection = await this.pool.getConnection();
    try {
      const query = `UPDATE Question SET question = ?, answer = ? WHERE id = ?`;
      const [result] = await connection.execute(query, [
        question.question,
        question.answer,
        questionId,
      ]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteQuestion(questionId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Question WHERE id = ?`;
      const [result] = await connection.execute(query, [questionId]);
      return result;
    } catch (err) {
      console.error('Error executing query:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteQuestionsByCardId(cardId) {
    const connection = await this.pool.getConnection();
    try {
      const query = `DELETE FROM Question WHERE card_id = ?`;
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

export default QuestionRepository;