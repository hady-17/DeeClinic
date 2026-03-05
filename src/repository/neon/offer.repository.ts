import { IRepository } from "../IRepository";
import { Offer } from "../../models/offer.model";
import logger from "../../utils/logger";
import {DBexception} from "../../utils/exceptions/repositoryException";
import ConnectionManager from "../../utils/dbConnectionManager";
/**id: string;
    title: string;
    type: offerType;
    price: number;
    service_ids: string[];
    duration_minutes?: number;
    start_date: Date;
    end_date: Date;
    active: offerStatus = offerStatus.ACTIVE; */
const tableName = "offers";
const create_table = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    service_ids TEXT NOT NULL,
    duration_minutes INT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    active VARCHAR(50) NOT NULL
);`;
const insert_offer = `INSERT INTO ${tableName} (id, title, type, price, service_ids, duration_minutes, start_date, end_date, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;`;
const get_by_id = `SELECT * FROM ${tableName} WHERE id = $1;`;
const get_all = `SELECT * FROM ${tableName};`;
const update_offer = `UPDATE ${tableName} SET title = $2, type = $3, price = $4, service_ids = $5, duration_minutes = $6, start_date = $7, end_date = $8, active = $9 WHERE id = $1;`;
const delete_offer = `DELETE FROM ${tableName} WHERE id = $1;`;
export class OfferRepository implements IRepository<Offer>{
        constructor() {}
    async init() {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            await conn.query(create_table);
            logger.info("OfferRepository initialized successfully");
            await db.end();
        } catch (error) {
            logger.error(`Error initializing OfferRepository: ${error}`);
            throw new DBexception("Failed to initialize OfferRepository", error as Error);
        }
    }
    async create(offer: Offer): Promise<string> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            const id = offer.id;
            await conn.query(insert_offer, [
                id,
                offer.title,
                offer.type,
                offer.price,
                JSON.stringify(offer.service_ids),
                offer.duration_minutes,
                offer.start_date,
                offer.end_date,
                offer.active
            ]);
            await conn.query("COMMIT");
            logger.info(`Offer created with id: ${id}`);
            await db.end();
            return id;
        }
            catch (error) {
                if (conn) {
                    await conn.query("ROLLBACK");
                }
            logger.error(`Error creating offer: ${error}`);
            throw new DBexception("Failed to create offer", error as Error);
        }
    }
    async getById(id: string): Promise<Offer> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_by_id, [id]);
            await db.end();
            if (result.rows.length === 0) {
                throw new DBexception(`Offer with id ${id} not found`, new Error("Not Found"));
            }
            const row = result.rows[0];
            const offer: Offer = {
                id: row.id,
                title: row.title,
                type: row.type,
                price: parseFloat(row.price),
                service_ids: JSON.parse(row.service_ids),
                duration_minutes: row.duration_minutes,
                start_date: new Date(row.start_date),
                end_date: new Date(row.end_date),
                active: row.active
            } as unknown as Offer;
            logger.info(`Offer retrieved with id: ${id}`);
            return offer;
        } catch (error) {
            logger.error(`Error retrieving offer with id ${id}: ${error}`);
            throw new DBexception("Failed to retrieve offer", error as Error);
        }
    }
    async getAll(): Promise<Offer[]> {
        try {
            const db = new ConnectionManager();
            const conn = await db.getPool();
            const result = await conn.query(get_all);
            await db.end();
            if (result.rows.length === 0) {
                logger.info("No offers found in database");
                return [];
            }
            const offers: Offer[] = result.rows.map((row) => ({
                id: row.id,
                title: row.title,
                type: row.type,
                price: parseFloat(row.price),
                service_ids: JSON.parse(row.service_ids),
                duration_minutes: row.duration_minutes,
                start_date: new Date(row.start_date),
                end_date: new Date(row.end_date),
                active: row.active
            } as unknown as Offer));
            logger.info(`All offers retrieved, count: ${offers.length}`);
            return offers;
        }
            catch (error) {
            logger.error(`Error retrieving all offers: ${error}`);
            throw new DBexception("Failed to retrieve offers", error as Error);
        }
    }
    async update(id: string, item: Offer): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            await conn.query(update_offer, [
                id,
                item.title,
                item.type,
                item.price,
                JSON.stringify(item.service_ids),
                item.duration_minutes,
                item.start_date,
                item.end_date,
                item.active
            ]);
            await conn.query("COMMIT");
            logger.info(`Offer updated with id: ${id}`);
            await db.end();
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error updating offer with id ${id}: ${error}`);
            throw new DBexception("Failed to update offer", error as Error);
        }
    }
    async delete(id: string): Promise<void> {
        let conn;
        const db = new ConnectionManager();
        try {
            conn = await db.getPool();
            await conn.query("BEGIN");
            await conn.query(delete_offer, [id]);
            await conn.query("COMMIT");
            logger.info(`Offer deleted with id: ${id}`);
            await db.end();
        }
        catch (error) {
            if (conn) {
                await conn.query("ROLLBACK");
            }
            logger.error(`Error deleting offer with id ${id}: ${error}`);
            throw new DBexception("Failed to delete offer", error as Error);
        }
    }
    
}