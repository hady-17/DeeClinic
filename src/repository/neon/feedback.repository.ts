import { IRepository } from "../IRepository";
import { Feedback } from "../../models/feedback.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import ConnectionManager from "../../utils/dbConnectionManager";
/**id: string;
    appointment_id: string;
    rating: FeedbackRating;
    comment?: string;
    created_at?: Date; */
const tableName = "feedbacks";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    appointment_id VARCHAR(255) NOT NULL,
    rating VARCHAR(50) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;
const insert_feedback = `INSERT INTO ${tableName} (id, appointment_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const get_by_appointment_id = `SELECT * FROM ${tableName} WHERE appointment_id = $1;`;
const update_feedback = `UPDATE ${tableName} SET appointment_id = $2, rating = $3, comment = $4, created_at = $5 WHERE id = $1;`;
const delete_feedback = `DELETE FROM ${tableName} WHERE id = $1;`;
export class FeedbackRepository implements IRepository<Feedback>{
        constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("FeedbackRepository initialized successfully");
            await db.end();
        }
        catch (error) {
            logger.error(`Error initializing FeedbackRepository: ${error}`);
            throw new DBexception("Failed to initialize FeedbackRepository", error as Error);
        }
    }
    async create(item: Feedback): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = item.id;
            await conn.query(insert_feedback, [
                id,
                item.appointment_id,
                item.rating,
                item.comment,
                item.created_at || new Date()
            ]);
            logger.info(`Feedback created with ID: ${id}`);
            await conn.query("COMMIT");
            return id;
        }
            catch (error) {
                    if (conn) {
                        await conn.query("ROLLBACK");
                    }
                logger.error(`Error creating feedback: ${error}`);
                throw new DBexception("Failed to create feedback", error as Error);
            }
    }
    async getById(id: string): Promise<Feedback> {
        try{
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_id, [id]);
            if (result.rows.length === 0) {
                throw new Error(`Feedback with ID ${id} not found`);
            }
            logger.info(`Feedback fetched with ID: ${id}`);
            await db.end();
            return result.rows[0];
        }
        catch (error) {
            logger.error(`Error fetching feedback by ID: ${error}`);
            throw new DBexception("Failed to fetch feedback by ID", error as Error);
        }
    }
    async getAll(): Promise<Feedback[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all);
            if (result.rows.length === 0) {
                logger.info("No feedbacks found in the database");
                return [];
            }
            logger.info(`Fetched all feedbacks, count: ${result.rows.length}`);
            await db.end();
            return result.rows;
        }
        catch (error) {
            logger.error(`Error fetching all feedbacks: ${error}`);
            throw new DBexception("Failed to fetch all feedbacks", error as Error);
        }
    }
    async getByAppointmentId(appointment_id: string): Promise<Feedback[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_appointment_id, [appointment_id]);
            if (result.rows.length === 0) {
                logger.info(`No feedbacks found for appointment ID: ${appointment_id}`);
                return [];
            }
            logger.info(`Fetched feedbacks for appointment ID: ${appointment_id}, count: ${result.rows.length}`);
            await db.end();
            return result.rows;
        }
        catch (error) {
            logger.error(`Error fetching feedbacks by appointment ID: ${error}`);
            throw new DBexception("Failed to fetch feedbacks by appointment ID", error as Error);
        }
    }
    async update(id: string, item: Feedback): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const result = await conn.query(update_feedback, [
                id,
                item.appointment_id,
                item.rating,
                item.comment,
                item.created_at || new Date()
            ]);
            if (result.rowCount === 0) {
                throw new Error(`Feedback with ID ${id} not found for update`);
            }
            logger.info(`Feedback with ID ${id} updated successfully`);
            await conn.query("COMMIT");
            await db.end();
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error updating feedback: ${error}`);
            throw new DBexception("Failed to update feedback", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            const result = await conn.query(delete_feedback, [id]);
            if (result.rowCount === 0) {
                throw new Error(`Feedback with ID ${id} not found for deletion`);
            }
            logger.info(`Feedback with ID ${id} deleted successfully`);
            await db.end();
        }
        catch (error) {            logger.error(`Error deleting feedback: ${error}`);
            throw new DBexception("Failed to delete feedback", error as Error);
        }
    }
}
