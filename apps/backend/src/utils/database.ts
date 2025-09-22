import { Pool, PoolClient, QueryResult } from 'pg';
import { DATABASE_CONFIG } from '../config';
import { ChatMessage } from './general';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// ===== DATABASE CONNECTION =====

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_CONFIG.CONNECTION_STRING,
      max: DATABASE_CONFIG.MAX_CONNECTIONS,
      idleTimeoutMillis: DATABASE_CONFIG.IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DATABASE_CONFIG.CONNECTION_TIMEOUT_MS,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Handle pool errors
    pool.on('error', (err: Error) => {
      log.error('Database Pool', err);
    });

    log.info('Database', 'Connection pool created');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    log.info('Database', 'Connection pool closed');
  }
}

// ===== DATABASE INITIALIZATION =====

export async function initializeDatabase(): Promise<void> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    log.step('Database Init', 'Connecting to database');
    client = await pool.connect();
    
    // Create chat_history table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        site_id VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'json')),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create gift_cards table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS gift_cards (
        id SERIAL PRIMARY KEY,
        site_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on site_id for gift cards
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_cards_site_id 
      ON gift_cards(site_id)
    `);

    // Create index on site_id for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_site_id 
      ON chat_history(site_id)
    `);

    // Create index on timestamp for ordering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp 
      ON chat_history(site_id, timestamp)
    `);

    log.result('Database Init', true, 'Tables and indexes created');
  } catch (error) {
    log.error('Database Init', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// ===== CHAT HISTORY OPERATIONS =====

export async function loadHistory(siteId?: string): Promise<ChatMessage[]> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = siteId 
      ? 'SELECT role, content, content_type, timestamp FROM chat_history WHERE site_id = $1 ORDER BY timestamp ASC'
      : 'SELECT role, content, content_type, timestamp FROM chat_history WHERE site_id IS NULL ORDER BY timestamp ASC';
    
    const params = siteId ? [siteId] : [];
    const result = await client.query(query, params);
    
    const messages: ChatMessage[] = result.rows.map((row: any) => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content_type === 'json' ? JSON.parse(row.content) : row.content,
      timestamp: row.timestamp?.toISOString()
    }));

    log.info('Database Load History', `Loaded ${messages.length} messages for site ${siteId || 'global'}`);
    return messages;
  } catch (error) {
    log.error('Database Load History', error);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function saveHistory(history: ChatMessage[], siteId?: string): Promise<void> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete existing history for this site
    const deleteQuery = siteId 
      ? 'DELETE FROM chat_history WHERE site_id = $1'
      : 'DELETE FROM chat_history WHERE site_id IS NULL';
    const deleteParams = siteId ? [siteId] : [];
    await client.query(deleteQuery, deleteParams);
    
    // Insert new history
    if (history.length > 0) {
      const insertQuery = `
        INSERT INTO chat_history (site_id, role, content, content_type, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      for (const message of history) {
        const content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);
        const contentType = typeof message.content === 'string' ? 'text' : 'json';
        const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
        
        await client.query(insertQuery, [
          siteId || null,
          message.role,
          content,
          contentType,
          timestamp
        ]);
      }
    }
    
    await client.query('COMMIT');
    log.result('Database Save History', true, `Saved ${history.length} messages for site ${siteId || 'global'}`);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    log.error('Database Save History', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function appendToHistory(newMessages: ChatMessage[], siteId?: string): Promise<void> {
  if (!newMessages.length) return;
  
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const insertQuery = `
      INSERT INTO chat_history (site_id, role, content, content_type, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    for (const message of newMessages) {
      const content = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);
      const contentType = typeof message.content === 'string' ? 'text' : 'json';
      const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
      
      await client.query(insertQuery, [
        siteId || null,
        message.role,
        content,
        contentType,
        timestamp
      ]);
    }
    
    log.result('Database Append History', true, `Appended ${newMessages.length} messages for site ${siteId || 'global'}`);
  } catch (error) {
    log.error('Database Append History', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function deleteHistory(siteId?: string): Promise<void> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = siteId 
      ? 'DELETE FROM chat_history WHERE site_id = $1'
      : 'DELETE FROM chat_history WHERE site_id IS NULL';
    const params = siteId ? [siteId] : [];
    
    const result = await client.query(query, params);
    log.result('Database Delete History', true, `Deleted ${result.rowCount} messages for site ${siteId || 'global'}`);
  } catch (error) {
    log.error('Database Delete History', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// ===== GIFT CARD OPERATIONS =====

export interface GiftCard {
  id: number;
  site_id: string;
  name: string;
  description: string | null;
  price: number;
  created_at: string;
  updated_at: string;
}

export async function createGiftCard(siteId: string, name: string, description: string | null, price: number): Promise<GiftCard> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = `
      INSERT INTO gift_cards (site_id, name, description, price)
      VALUES ($1, $2, $3, $4)
      RETURNING id, site_id, name, description, price, created_at, updated_at
    `;
    
    const result = await client.query(query, [siteId, name, description, price]);
    const giftCard = result.rows[0];
    
    log.result('Database Create Gift Card', true, `Created gift card ${giftCard.id} for site ${siteId}`);
    return giftCard;
  } catch (error) {
    log.error('Database Create Gift Card', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getAllGiftCards(siteId: string): Promise<GiftCard[]> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = `
      SELECT id, site_id, name, description, price, created_at, updated_at
      FROM gift_cards
      WHERE site_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query, [siteId]);
    const giftCards = result.rows;
    
    log.result('Database Get All Gift Cards', true, `Retrieved ${giftCards.length} gift cards for site ${siteId}`);
    return giftCards;
  } catch (error) {
    log.error('Database Get All Gift Cards', error);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getGiftCardById(siteId: string, id: number): Promise<GiftCard | null> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = `
      SELECT id, site_id, name, description, price, created_at, updated_at
      FROM gift_cards
      WHERE id = $1 AND site_id = $2
    `;
    
    const result = await client.query(query, [id, siteId]);
    
    if (result.rows.length === 0) {
      log.info('Database Get Gift Card', `Gift card ${id} not found for site ${siteId}`);
      return null;
    }
    
    const giftCard = result.rows[0];
    log.result('Database Get Gift Card', true, `Retrieved gift card ${id} for site ${siteId}`);
    return giftCard;
  } catch (error) {
    log.error('Database Get Gift Card', error);
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function updateGiftCard(siteId: string, id: number, name: string, description: string | null, price: number): Promise<GiftCard | null> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = `
      UPDATE gift_cards 
      SET name = $1, description = $2, price = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND site_id = $5
      RETURNING id, site_id, name, description, price, created_at, updated_at
    `;
    
    const result = await client.query(query, [name, description, price, id, siteId]);
    
    if (result.rows.length === 0) {
      log.info('Database Update Gift Card', `Gift card ${id} not found for site ${siteId}`);
      return null;
    }
    
    const giftCard = result.rows[0];
    log.result('Database Update Gift Card', true, `Updated gift card ${id} for site ${siteId}`);
    return giftCard;
  } catch (error) {
    log.error('Database Update Gift Card', error);
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function deleteGiftCard(siteId: string, id: number): Promise<boolean> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    
    const query = 'DELETE FROM gift_cards WHERE id = $1 AND site_id = $2';
    const result = await client.query(query, [id, siteId]);
    
    const success = (result.rowCount ?? 0) > 0;
    log.result('Database Delete Gift Card', success, `Deleted gift card ${id} for site ${siteId}`);
    return success;
  } catch (error) {
    log.error('Database Delete Gift Card', error);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// ===== HEALTH CHECK =====

export async function checkDatabaseConnection(): Promise<boolean> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    log.result('Database Health Check', true);
    return true;
  } catch (error) {
    log.error('Database Health Check', error);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}
