import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const ch = createClient({
  url:      process.env.CLICKHOUSE_URL      || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB       || 'shopkit',
  username: process.env.CLICKHOUSE_USER     || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,   // fire-and-forget; set to 1 for guaranteed durability
  },
});

export default ch;
