import logger from "../../utils/logger";
import { Client } from "../../models/client.model";
import { IRepository } from "../../repository/IRepository";
import { DBexception, InvalidItemException } from "../../utils/exceptions/repositoryException";
import { ConnectionManager } from "../../utils/dbConnectionManager"; 
/**
 * id: string;
    name: string;
    phone: string;
    created_at?: Date;
 */
const TABLE_NAME = "clients";
const insert_client_query = `INSERT INTO ${TABLE_NAME} (id, name, phone) VALUES ($1, $2, $3) RETURNING id;`;
const get_client_by_id_query = `SELECT * FROM ${TABLE_NAME} WHERE id = $1;`;
const get_all_clients_query = `SELECT * FROM ${TABLE_NAME};`;
const update_client_query = `UPDATE ${TABLE_NAME} SET name = COALESCE($2, name), phone = COALESCE($3, phone) WHERE id = $1 RETURNING *;`;
const delete_client_query = `DELETE FROM ${TABLE_NAME} WHERE id = $1;`;

export class NeonClientRepository implements IRepository<Client> {
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const pool = db.getPool();
            const create_table_query = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`;
            await pool.query(create_table_query);
            logger.info("Client repository initialized and table ensured.");
        } catch (err) {
            logger.error("Failed to initialize Client repository", err);
            throw new DBexception("Failed to initialize Client repository", err as Error);
        }
    }
    async create(client: Client): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = client.id;
            await conn.query(insert_client_query, [
                id,
                client.name,
                client.phone
            ]);
            logger.info(`Client created with id: ${id}`);
            await conn.query("COMMIT");
            return id;
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error creating client: ${error}`);
            throw new DBexception("Failed to create client", error as Error);
        }
    }
    async getById(id: string): Promise<Client> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_client_by_id_query, [id]);
            if (result.rows.length === 0) {
                throw new InvalidItemException(`Client with id ${id} not found`);
            }
            logger.info(`Client retrieved with id: ${id}`);
            return result.rows[0];
        } catch (error) {
            logger.error(`Error retrieving client with id ${id}: ${error}`);
            throw new DBexception("Failed to retrieve client", error as Error);
        }
    }
    async getAll(): Promise<Client[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all_clients_query);
            logger.info(`All clients retrieved, count: ${result.rows.length}`);
            return result.rows;
        } catch (error) {
            logger.error(`Error retrieving all clients: ${error}`);
            throw new DBexception("Failed to retrieve all clients", error as Error);
        }
    }
    async update(id: string, client: Client): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(update_client_query, [
                id,
                client.name,
                client.phone
            ]);
            if (result.rowCount === 0) {
                throw new InvalidItemException(`Client with id ${id} not found for update`);
            }
            logger.info(`Client with id ${id} updated successfully`);
            await conn.query("COMMIT");
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error updating client with id ${id}: ${error}`);
            throw new DBexception("Failed to update client", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(delete_client_query, [id]);
            if (result.rowCount === 0) {
                throw new InvalidItemException(`Client with id ${id} not found for deletion`);
            }
            logger.info(`Client with id ${id} deleted successfully`);
            await conn.query("COMMIT");
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error deleting client with id ${id}: ${error}`);
            throw new DBexception("Failed to delete client", error as Error);
        }
    }
}