import { createPool } from 'mysql2/promise';

class MysqlPoolProvider {
  static pool = null;

  static getPool() {
    const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = process.env;
    if (!this.pool) {
      this.pool = createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASS,
        database: DB_NAME,
        port: DB_PORT || 3306,
        connectionLimit: 10,
        // MySQL2에서 유효한 옵션들로 변경
        connectTimeout: 60000,
        // reconnect 옵션 제거 (MySQL2에서 지원하지 않음)
        queueLimit: 0,
      });
    }
    return this.pool;
  }

  static async closePool() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export default MysqlPoolProvider;
