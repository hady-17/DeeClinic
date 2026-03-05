import { IRepository } from "../IRepository";
import { Service } from "../../models/services.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import ConnectionManager from "../../utils/dbConnectionManager";


/**id: string
    name: string;
    description: string;
    image_url?: string;
    price: number;
    cost_price: number;
    duration_minutes: number;
    status?: serviceStatus = serviceStatus.ACTIVE;
    created_at?: Date; */
const tableName = "services";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    price NUMERIC(10, 2) NOT NULL,
    cost_price NUMERIC(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;
const insert_service = `INSERT INTO ${tableName} (id, name, description, image_url, price, cost_price, duration_minutes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const update_service = `UPDATE ${tableName} SET name = $2, description = $3, image_url = $4, price = $5, cost_price = $6, duration_minutes = $7, status = $8 WHERE id = $1;`;
const delete_service = `DELETE FROM ${tableName} WHERE id = $1;`;
export class ServicesRepository implements IRepository<Service>{
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("ServicesRepository initialized successfully");
            await db.end();
        } catch (error) {
            logger.error(`Error initializing ServicesRepository: ${error}`);
            throw new DBexception("Failed to initialize ServicesRepository", error as Error);
        }
    }
    async create(item: Service): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = item.id;
            await conn.query(insert_service, [
                id,
                item.name,
                item.description,
                item.image_url || null,
                item.price,
                item.cost_price,
                item.duration_minutes,
                item.status
            ]);
            await conn.query("COMMIT");
            logger.info(`Service created with ID: ${id}`);
            return id;
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error creating Service: ${error}`);
            throw new DBexception("Failed to create Service", error as Error);
        }
    }
    async getById(id: string): Promise<Service> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_id, [id]);
            if (result.rows.length === 0) {
                throw new Error(`Service with ID ${id} not found`);
            }
            await db.end();
            return result.rows[0];
        } catch (error) {
            logger.error(`Error fetching Service by ID: ${error}`);
            throw new DBexception("Failed to fetch Service by ID", error as Error);
        }
    }
    async getAll(): Promise<Service[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all);
            if (result.rows.length === 0) {
                logger.info("No Services found in the database");
                return [];
            }
            await db.end();
            return result.rows;
        } catch (error) {
            logger.error(`Error fetching all Services: ${error}`);
            throw new DBexception("Failed to fetch all Services", error as Error);
        }
    }
    async update(id: string, item: Partial<Omit<Service, "id">>): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            await conn.query(update_service, [
                id,
                item.name || null,
                item.description || null,
                item.image_url || null,
                item.price || null,
                item.cost_price || null,
                item.duration_minutes || null,
                item.status || null
            ]);
            await conn.query("COMMIT");
            logger.info(`Service with ID: ${id} updated successfully`);
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error updating Service: ${error}`);
            throw new DBexception("Failed to update Service", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(delete_service, [id]);
            if (result.rowCount === 0) {
                throw new Error(`Service with ID ${id} not found for deletion`);
            }
            await conn.query("COMMIT");
            logger.info(`Service with ID: ${id} deleted successfully`);
        } catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error deleting Service: ${error}`);
            throw new DBexception("Failed to delete Service", error as Error);
        }
    }
    
}