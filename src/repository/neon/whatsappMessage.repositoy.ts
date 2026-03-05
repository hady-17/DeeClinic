import { IRepository } from "../IRepository";
import { WhatsAppMessage } from "../../models/whatsappMessage.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import uuid from "uuid";
import ConnectionManager from "../../utils/dbConnectionManager";

/**
 * id: string;
     appointment_id: string;
     type: whatsAppMessageType;
     to_phone: string;
     payload_json: string;
     status: whatsAppMessageStatus;
     scheduled_for: Date;
     sent_at?: Date;
 */
const tableName = "whatsapp_messages";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    appointment_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    payload_json TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP
);`;
const insert_whatsapp_message = `INSERT INTO ${tableName} (id, appointment_id, type, to_phone, payload_json, status, scheduled_for, sent_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const get_by_appointment_id = `SELECT * FROM ${tableName} WHERE appointment_id = $1;`;
const get_messages_toPhone = `SELECT * FROM ${tableName} WHERE to_phone = $1;`;
const update_whatsapp_message = `UPDATE ${tableName} SET appointment_id = $2, type = $3, to_phone = $4, payload_json = $5, status = $6, scheduled_for = $7, sent_at = $8 WHERE id = $1;`;
const delete_whatsapp_message = `DELETE FROM ${tableName} WHERE id = $1;`;
export class WhatsAppMessageRepository implements IRepository<WhatsAppMessage>{
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("WhatsAppMessageRepository initialized successfully");
            await db.end();
        } catch (error) {
            logger.error(`Error initializing WhatsAppMessageRepository: ${error}`);
            throw new DBexception("Failed to initialize WhatsAppMessageRepository", error as Error);
        }
    }
    // Implement the create method to insert a new WhatsAppMessage into the database
    async create(item: WhatsAppMessage): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = uuid.v4();
            await conn.query(insert_whatsapp_message, [
                id,
                item.appointment_id,
                item.type,
                item.to_phone,
                item.payload_json,
                item.status,
                item.scheduled_for,
                item.sent_at || null
            ]);
            logger.info(`WhatsAppMessage created with id: ${id}`);
            await conn.query("COMMIT");
            return id;
        } 
            catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error connecting to database in create method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
    // Implement the getById method to retrieve a WhatsAppMessage by its ID from the database
    async getById(id: string): Promise<WhatsAppMessage> {
        try{
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_id, [id]);
            if (result.rows.length === 0) {
                throw new Error(`WhatsAppMessage with id ${id} not found`);
            }
            logger.info(`WhatsAppMessage retrieved with id: ${id}`);
            return result.rows[0];
        } catch (error) {
            logger.error(`Error connecting to database in getById method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
    // Implement the getAll method to retrieve all WhatsAppMessages from the database
    async getAll(): Promise<WhatsAppMessage[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all);
            if (result.rows.length === 0) {
                logger.info("No WhatsAppMessages found in database");
                return [];
            }
            logger.info(`All WhatsAppMessages retrieved, count: ${result.rows.length}`);
            return result.rows;
        }
        catch (error) {
            logger.error(`Error connecting to database in getAll method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
    async getByAppointmentId(appointment_id: string): Promise<WhatsAppMessage[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_appointment_id, [appointment_id]);
            if (result.rows.length === 0) {
                logger.info(`No WhatsAppMessages found for appointment_id: ${appointment_id}`);
                return [];
            }
            logger.info(`WhatsAppMessages retrieved for appointment_id: ${appointment_id}, count: ${result.rows.length}`);
            return result.rows;
        }
        catch (error) {
            logger.error(`Error connecting to database in getByAppointmentId method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
    async getByToPhone(to_phone: string): Promise<WhatsAppMessage[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_messages_toPhone, [to_phone]);
            if (result.rows.length === 0) {
                logger.info(`No WhatsAppMessages found for to_phone: ${to_phone}`);
                return [];
            }
            logger.info(`WhatsAppMessages retrieved for to_phone: ${to_phone}, count: ${result.rows.length}`);
            return result.rows;
        }
        catch (error) {
            logger.error(`Error connecting to database in getByToPhone method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }

    async update(id: string, item: WhatsAppMessage): Promise<void> {
       let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(update_whatsapp_message, [
                id,
                item.appointment_id,
                item.type,
                item.to_phone,
                item.payload_json,
                item.status,
                item.scheduled_for,
                item.sent_at || null
            ]);
            if (result.rowCount === 0) {
                throw new Error(`WhatsAppMessage with id ${id} not found for update`);
            }
            logger.info(`WhatsAppMessage with id ${id} updated successfully`);
            await conn.query("COMMIT");
        }
            catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error connecting to database in update method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(delete_whatsapp_message, [id]);
            if (result.rowCount === 0) {
                throw new Error(`WhatsAppMessage with id ${id} not found for deletion`);
            }
            logger.info(`WhatsAppMessage with id ${id} deleted successfully`);
            await conn.query("COMMIT");
            
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error connecting to database in delete method: ${error}`);
            throw new DBexception("Failed to connect to database", error as Error);
        }
    }
}