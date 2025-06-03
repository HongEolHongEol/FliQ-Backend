import { createPool } from 'mysql2/promise';

class MysqlPoolProvider {
  static pool = null;

  static getPool() {
    if (!this.pool) {
      this.pool = createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        connectionLimit: 10,
        // MySQL2에서 유효한 옵션들로 변경
        acquireTimeout: 60000,
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