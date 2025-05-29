
// === 수정된 provider.js (변경사항 없음, 하지만 개선사항 추가) ===
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
        connectionLimit: 10, // 4에서 10으로 증가
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
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