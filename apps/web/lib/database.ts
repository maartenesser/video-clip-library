import { DatabaseClient, createDatabaseClient } from '@video-clip-library/database';

let databaseClient: DatabaseClient | null = null;

/**
 * Get the database client singleton
 */
export function getDatabase(): DatabaseClient {
  if (!databaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable is required');
    }

    databaseClient = createDatabaseClient({
      supabaseUrl,
      supabaseKey,
    });
  }

  return databaseClient;
}

/**
 * Reset the database client (for testing)
 */
export function resetDatabase(): void {
  databaseClient = null;
}

/**
 * Set a mock database client (for testing)
 */
export function setDatabase(client: DatabaseClient): void {
  databaseClient = client;
}
