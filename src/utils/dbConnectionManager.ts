import { Pool } from "pg";
import { InitializationException } from "../utils/exceptions/repositoryException";

/**
 * Neon ConnectionManager
 *
 * Provides a cached `pg.Pool` configured from environment variables. It
 * prefers `NEON_DATABASE_URL` (common for Neon) and falls back to
 * `DATABASE_URL`. Validates host to catch placeholder values early.
 */
export class ConnectionManager {
	private pool?: Pool;

	getPool(): Pool {
		if (this.pool) return this.pool;

		const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
		if (!connectionString) {
			throw new InitializationException("NEON connection manager initialization failed", new Error("Missing NEON_DATABASE_URL or DATABASE_URL environment variable"));
		}

		// Basic validation: ensure the connection string parses and host is not a placeholder
		try {
			const parsed = new URL(connectionString);
			const hostname = parsed.hostname;
			if (!hostname || hostname === "base" || hostname === "<base>" || hostname === "<host>") {
				throw new InitializationException("NEON connection manager initialization failed", new Error(`Invalid NEON host '${hostname}'. Update NEON_DATABASE_URL in .env`));
			}
		} catch (err) {
			if (err instanceof InitializationException) throw err;
			throw new InitializationException("NEON connection manager initialization failed", err as Error);
		}

		try {
			this.pool = new Pool({
				connectionString,
				ssl: { rejectUnauthorized: false }
			});
		} catch (err) {
			throw new InitializationException("NEON connection manager initialization failed", err as Error);
		}

		return this.pool;
	}

	async end(): Promise<void> {
		if (this.pool) {
			await this.pool.end();
			this.pool = undefined;
		}
	}
}

export default ConnectionManager;
