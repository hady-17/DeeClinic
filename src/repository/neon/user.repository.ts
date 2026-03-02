import logger from "../../utils/logger";
import { User } from "../../models/user.model";
import { IRepository } from "../../repository/IRepository";
import { DBexception, InvalidItemException } from "../../utils/exceptions/repositoryException";
import { ConnectionManager } from "../../utils/dbConnectionManager";
import uuid from "uuid"; 


/** id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    status : UserStatus;
    created_at?: Date;*/
const TABLE_NAME = "users";
const create_table_query = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'RECEPTIONIST',
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
const insert_user_query = `INSERT INTO ${TABLE_NAME} (id, name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`;
const get_user_by_id_query = `SELECT * FROM ${TABLE_NAME} WHERE id = $1;`;
const get_user_by_email_query = `SELECT * FROM ${TABLE_NAME} WHERE email = $1;`;
const get_all_users_query = `SELECT * FROM ${TABLE_NAME};`;
const update_user_query = `UPDATE ${TABLE_NAME} SET name = COALESCE($2, name), email = COALESCE($3, email), password_hash = COALESCE($4, password_hash), role = COALESCE($5, role), status = COALESCE($6, status) WHERE id = $1 RETURNING *;`;
const delete_user_query = `DELETE FROM ${TABLE_NAME} WHERE id = $1;`;

export class NeonUserRepository implements IRepository<User> {

    constructor() {}
    // Initialize the repository by ensuring the users table exists
    async init() {
        try {
            const db = new ConnectionManager();
            const pool = db.getPool();
            await pool.query(create_table_query);
            logger.info("User repository initialized and table ensured.");
        } catch (err) {
            logger.error("Failed to initialize User repository", err);
            throw new DBexception("Failed to initialize User repository", err as Error);
        }
    }
    async create(user: User): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            if (!user.getName || !user.getEmail || !user.getPasswordHash || !user.getRole || !user.getStatus) {
                throw new InvalidItemException("Invalid user object. Missing required fields.");
            }
            conn = db.getPool();
            // Start a transaction
            await conn.query("BEGIN");
            const userId = user.getId ? user.getId() : uuid.v4();
            const checkEmailQuery = `SELECT 1 FROM ${TABLE_NAME} WHERE email = $1`;
            const emailCheckResult = await conn.query(checkEmailQuery, [user.getEmail()]);
            if (emailCheckResult.rows.length > 0) {
                throw new InvalidItemException(`User with email ${user.getEmail()} already exists`);
            }
            const result = await conn.query(insert_user_query, [userId, user.getName(), user.getEmail(), user.getPasswordHash(), user.getRole(), user.getStatus()]);
            await conn.query("COMMIT");
            logger.debug(`Insert result rows: ${JSON.stringify(result.rows)}`);
            logger.info(`User created with ID: ${result.rows[0] ? result.rows[0].id : userId}`);
            return userId;
        } catch (err) {
            // Rollback transaction on error
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error("Failed to create user", err);
            throw new DBexception("Failed to create user", err as Error);
        }
    }
    async getById(id: string): Promise<User> {
        try {
            const db = new ConnectionManager();
            const pool = db.getPool();
            /**
             * Note: We could optimize this by caching prepared statements or using a connection pool more effectively, but for simplicity we are just querying directly here.
             * how it works: we get a connection from the pool, execute the query with the provided id, and if a user is found, we construct a User object from the database row. If no user is found, we throw an InvalidItemException. Any database errors are caught and rethrown as DBexceptions with logging for debugging.
             */
            return pool.query(get_user_by_id_query, [id])
                .then(result => {
                    if (result.rows.length === 0) {
                        throw new InvalidItemException(`User with id ${id} not found`);
                    }
                    const row = result.rows[0];
                    return new User(row.id, row.name, row.email, row.password_hash, row.role, row.status, row.created_at);
                });
        }
        catch (err) {
            logger.error(`Failed to get user by id ${id}`, err);
            throw new DBexception(`Failed to get user by id ${id}`, err as Error);
        }
    }
    async getbyEmail(email: string): Promise<User> {
        try{
            const db = new ConnectionManager();
            const pool = db.getPool();
            const result = await pool.query(get_user_by_email_query, [email]);
            if (result.rows.length === 0) {
                throw new InvalidItemException(`User with email ${email} not found`);
            }
            const row = result.rows[0];
            return new User(row.id, row.name, row.email, row.password_hash, row.role, row.status, row.created_at);
        }
        catch (err) {
            logger.error(`Failed to get user by email ${email}`, err);
            throw new DBexception(`Failed to get user by email ${email}`, err as Error);
        }
    }
    async getAll(): Promise<User[]> {
        try {
            const db = new ConnectionManager();
            const pool = db.getPool();
            const result = await pool.query(get_all_users_query);
            return result.rows.map(row => new User(row.id, row.name, row.email, row.password_hash, row.role, row.status, row.created_at));
        }catch (err) {
            logger.error("Failed to get all users", err);
            throw new DBexception("Failed to get all users", err as Error);
        }
    }
    async update(id: string, user: User): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            if (!user.getName || !user.getEmail || !user.getPasswordHash || !user.getRole || !user.getStatus) {
                throw new InvalidItemException("Invalid user object. Missing required fields.");
            }
            conn = db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(update_user_query, [id, user.getName(), user.getEmail(), user.getPasswordHash(), user.getRole(), user.getStatus()]);
            await conn.query("COMMIT");
            if (result.rows.length === 0) {
                throw new InvalidItemException(`User with id ${id} not found for update`);
            }
            logger.info(`User with id ${id} updated successfully`);
        } catch (err) {
            logger.error(`Failed to update user with id ${id}`, err);
            throw new DBexception(`Failed to update user with id ${id}`, err as Error);
        }
    }
    async delete(id: string) : Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = db.getPool();
            await conn.query("BEGIN");
             await conn.query(delete_user_query, [id]);
            await conn.query("COMMIT");
            logger.info(`User with id ${id} deleted successfully`);
        } catch (err) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Failed to delete user with id ${id}`, err);
            throw new DBexception(`Failed to delete user with id ${id}`, err as Error);
        }
    }
}