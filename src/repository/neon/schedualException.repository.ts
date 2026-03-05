import { IRepository } from "../IRepository";
import { ScheduleException } from "../../models/schedualException.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import ConnectionManager from "../../utils/dbConnectionManager";

/**id: string;
    date: Date;
    is_closed: boolean;
    open_time?: string;
    close_time?: string;
    note?: string; */
const tableName = "clinic_schedule_exceptions";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL,
    open_time TIME,
    close_time TIME,
    note TEXT
);`;
const insert_exception = `INSERT INTO ${tableName} (id, date, is_closed, open_time, close_time, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const update_exception = `UPDATE ${tableName} SET date = $2, is_closed = $3, open_time = $4, close_time = $5, note = $6 WHERE id = $1;`;
const delete_exception = `DELETE FROM ${tableName} WHERE id = $1;`;
export class NeonClinicScheduleRepository implements IRepository<ScheduleException>{
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("NeonClinicScheduleRepository initialized successfully");
            await db.end();
        }
        catch (error) {
            logger.error(`Error initializing NeonClinicScheduleRepository: ${error}`);
            throw new DBexception("Failed to initialize NeonClinicScheduleRepository", error as Error);
        }
    }
    async create(item: ScheduleException): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = item.id;
            await conn.query(insert_exception, [
                id,
                item.date,
                item.is_closed,
                item.open_time || null,
                item.close_time || null,
                item.note || null
            ]);
            await conn.query("COMMIT");
            logger.info(`ScheduleException created with ID: ${id}`);
            return id;
        }
            catch (error) {
                if (conn) {
                    await conn.query("ROLLBACK");
                }
                logger.error(`Error creating ScheduleException: ${error}`);
                throw new DBexception("Failed to create ScheduleException", error as Error);
            }
    }
    async getById(id: string): Promise<ScheduleException> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_id, [id]);
            if (result.rows.length === 0) {
                throw new Error(`ScheduleException with ID ${id} not found`);
            }
            await db.end();
            return result.rows[0];
        }
            catch (error) {
                logger.error(`Error fetching ScheduleException by ID: ${error}`);
                throw new DBexception("Failed to fetch ScheduleException by ID", error as Error);
            }
    }
    async getAll(): Promise<ScheduleException[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all);
            if (result.rows.length === 0) {
                logger.info("No ScheduleExceptions found in the database");
                return [];
            }
            await db.end();
            return result.rows;
        }
            catch (error) {  
              logger.error(`Error fetching all ScheduleExceptions: ${error}`);
                throw new DBexception("Failed to fetch all ScheduleExceptions", error as Error);
            }
    }
    async update(id: string, item: ScheduleException): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            await conn.query(update_exception, [
                id,
                item.date,
                item.is_closed,
                item.open_time || null,
                item.close_time || null,
                item.note || null
             ]);
            await conn.query("COMMIT");
            logger.info(`ScheduleException with ID: ${id} updated successfully`);
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error updating ScheduleException: ${error}`);
            throw new DBexception("Failed to update ScheduleException", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(delete_exception, [id]);
            if (result.rowCount === 0) {
                throw new Error(`ScheduleException with ID ${id} not found for deletion`);
            }
            await conn.query("COMMIT");
            logger.info(`ScheduleException with ID: ${id} deleted successfully`);
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error deleting ScheduleException: ${error}`);
            throw new DBexception("Failed to delete ScheduleException", error as Error);
        }
    }
}