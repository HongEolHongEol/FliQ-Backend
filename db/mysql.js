import { createPool } from "mysql2/promise";

class MySQLPoolProvider {
  static pool = null;

  static init() {
    this.pool = createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      connectionLimit: 4,
    });
  }

  static async getConnection() {
    return this.pool.getConnection();
  }
}

export default MySQLPoolProvider;