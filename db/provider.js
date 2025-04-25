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
        port: process.env.DB_PORT,
        connectionLimit: 4,
      });
    }
    return this.pool;
  }
}

export default MysqlPoolProvider;
