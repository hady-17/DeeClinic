import { IRepository } from "../IRepository";
import { Appointment } from "../../models/appointment.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import uuid from "uuid";
import ConnectionManager from "../../utils/dbConnectionManager";

/**
 * id: string;
     client_id: string;
     service_id: string; // or offer_id
     start_time: Date;
     end_time: Date;
     status: AppointmentStatus;
     client_note?: string;
     admin_note?: string;
     created_at?: Date;
     updated_at?: Date;
 */
const tableName = "appointments";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,
    client_note TEXT,
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
const insert_appointment = `INSERT INTO ${tableName} (id, client_id, service_id, start_time, end_time, status, client_note, admin_note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const update_appointment = `UPDATE ${tableName} SET client_id = $2, service_id = $3, start_time = $4, end_time = $5, status = $6, client_note = $7, admin_note = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`;
const delete_appointment = `DELETE FROM ${tableName} WHERE id = $1;`;
const get_appointments_by_client_id = `SELECT * FROM ${tableName} WHERE client_id = $1;`;
export class AppointmentRepository implements IRepository<Appointment>{
    constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("AppointmentRepository initialized successfully");
            await db.end();
        } catch (error) {
            logger.error(`Error initializing AppointmentRepository: ${error}`);
            throw new DBexception("Failed to initialize AppointmentRepository", error as Error);
        }
    }
    async create(item: Appointment): Promise<string> {
       let conn;
       const db = new ConnectionManager();
         try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = uuid.v4();
            await conn.query(insert_appointment, [
                id,
                item.client_id,
                item.service_id,
                item.start_time,
                item.end_time,
                item.status,
                item.client_note || null,
                item.admin_note || null
            ]);
            await conn.query("COMMIT");
            return id;
         }
         catch (error) {
            logger.error(`Error creating appointment: ${error}`);
            throw new DBexception("Failed to create appointment", error as Error);
         }
    }
    async getById(id: string): Promise<Appointment> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const res = await conn.query(get_by_id, [id]);
            if (res.rows.length === 0) {
                throw new Error(`Appointment with id ${id} not found`);
            }
            const row = res.rows[0];
            return row as Appointment;
        }
        catch (error) {
            logger.error(`Error retrieving appointment by id: ${error}`);
            throw new DBexception("Failed to retrieve appointment", error as Error);
        }
    }

    async getAll(): Promise<Appointment[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const res = await conn.query(get_all);
            return res.rows as Appointment[];
        }
        catch (error) {
            logger.error(`Error retrieving all appointments: ${error}`);
            throw new DBexception("Failed to retrieve all appointments", error as Error);
        }
    }
    async update(id: string, item: Partial<Omit<Appointment, "id">>): Promise<void> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(update_appointment, [
                id,
                item.client_id || null,
                item.service_id || null,
                item.start_time || null,
                item.end_time || null,
                item.status || null,
                item.client_note || null,
                item.admin_note || null
            ]);
        }
        catch (error) {
            logger.error(`Error updating appointment with id ${id}: ${error}`);
            throw new DBexception("Failed to update appointment", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(delete_appointment, [id]);
        }
        catch (error) {
            logger.error(`Error deleting appointment with id ${id}: ${error}`);
            throw new DBexception("Failed to delete appointment", error as Error);
        }
    }
    async getByClientId(client_id: string): Promise<Appointment[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const res = await conn.query(get_appointments_by_client_id, [client_id]);
            return res.rows as Appointment[];
        }
        catch (error) {
            logger.error(`Error retrieving appointments by client_id ${client_id}: ${error}`);
            throw new DBexception("Failed to retrieve appointments by client_id", error as Error);
        }
    }
}
