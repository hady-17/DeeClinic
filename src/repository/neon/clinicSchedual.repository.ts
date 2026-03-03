import logger from "../../utils/logger";
import { ClinicSchedule } from "../../models/clinicSchedual.model";
import { IRepository } from "../../repository/IRepository";
import { DBexception, InvalidItemException } from "../../utils/exceptions/repositoryException";
import { ConnectionManager } from "../../utils/dbConnectionManager";
import uuid from "uuid"; 

/**
 * id: string;
     weekday: Weekday;
     open_time: string;
     close_time: string;
     slot_step_minutes: number;
     active: UserStatus= UserStatus.ACTIVE;
 */
const TABLE_NAME = "clinic_schedule";
const insert_schedule_query = `INSERT INTO ${TABLE_NAME} (id, weekday, open_time, close_time, slot_step_minutes, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`;
const get_schedule_by_id_query = `SELECT * FROM ${TABLE_NAME} WHERE id = $1;`;
const get_all_schedules_query = `SELECT * FROM ${TABLE_NAME};`;
const update_schedule_query = `UPDATE ${TABLE_NAME} SET weekday = COALESCE($2, weekday), open_time = COALESCE($3, open_time), close_time = COALESCE($4, close_time), slot_step_minutes = COALESCE($5, slot_step_minutes), active = COALESCE($6, active) WHERE id = $1 RETURNING *;`;
const delete_schedule_query = `DELETE FROM ${TABLE_NAME} WHERE id = $1;`;
export class NeonClinicScheduleRepository implements IRepository<ClinicSchedule> {
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const pool = db.getPool();
            const create_table_query = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                id VARCHAR(255) PRIMARY KEY,
                weekday INT NOT NULL,
                open_time VARCHAR(5) NOT NULL,
                close_time VARCHAR(5) NOT NULL,
                slot_step_minutes INT DEFAULT 15,
                active VARCHAR(20) NOT NULL
            );`;
            await pool.query(create_table_query);
            logger.info("ClinicSchedule repository initialized and table ensured.");
        } catch (err) {
            logger.error("Failed to initialize ClinicSchedule repository", err);
            throw new DBexception("Failed to initialize ClinicSchedule repository", err as Error);
        }
    }
    async create(schedual: ClinicSchedule): Promise<string> {
        const db = new ConnectionManager();
        const pool = db.getPool();
        try {
            const id = uuid.v4();
            const result = await pool.query(insert_schedule_query, [
                id,
                schedual.weekday,
                schedual.open_time,
                schedual.close_time,
                schedual.slot_step_minutes,
                schedual.active
            ]);
            logger.info(`ClinicSchedule created with ID: ${id}`);
            return result.rows[0].id;
        } catch (err) {
            logger.error("Failed to create ClinicSchedule", err);
            throw new DBexception("Failed to create ClinicSchedule", err as Error);
        }
    }
    async getById(id: string): Promise<ClinicSchedule> {
        const db = new ConnectionManager();
        const pool = db.getPool();
        try {
            const result = await pool.query(get_schedule_by_id_query, [id]);
            if (result.rows.length === 0) {
                throw new InvalidItemException("ClinicSchedule not found");
            }
            return result.rows[0];
        } catch (err) {
            logger.error("Failed to get ClinicSchedule by ID", err);
            throw new DBexception("Failed to get ClinicSchedule by ID", err as Error);
        }
    }
    async getAll(): Promise<ClinicSchedule[]> {
        const db = new ConnectionManager();
        const pool = db.getPool();
        try {
            const result = await pool.query(get_all_schedules_query);
            return result.rows;
        } catch (err) {
            logger.error("Failed to get all ClinicSchedules", err);
            throw new DBexception("Failed to get all ClinicSchedules", err as Error);
        }
    }
    async update(id: string, schedule: ClinicSchedule): Promise<void> {
        const db = new ConnectionManager();
        const pool = db.getPool();
        try {
            await pool.query(update_schedule_query, [
                id,
                schedule.weekday ,
                schedule.open_time ,
                schedule.close_time ,
                schedule.slot_step_minutes,
                schedule.active ,
            ]);
        } catch (err) {
            logger.error("Failed to update ClinicSchedule", err);
            throw new DBexception("Failed to update ClinicSchedule", err as Error);
        }
    }
    async delete(id: string): Promise<void> {
        const db = new ConnectionManager();
        const pool = db.getPool();
        try {
            await pool.query(delete_schedule_query, [id]);
        } catch (err) {
            logger.error("Failed to delete ClinicSchedule", err);
            throw new DBexception("Failed to delete ClinicSchedule", err as Error);
        }
    }
}