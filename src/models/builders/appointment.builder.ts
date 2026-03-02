import logger from "../../utils/logger";
import { Appointment, AppointmentStatus } from "../../models/appointment.model";
import { v4 as uuidv4 } from "uuid";
/**
 * id: string;
    client_id: string;
    service_id: string;
    start_time: Date;
    end_time: Date;
    status: AppointmentStatus = AppointmentStatus.PENDING;
    client_note?: string;
    admin_note?: string;
    created_at?: Date;
    updated_at?: Date;
 */
export class AppointmentBuilder {
    private id: string = uuidv4();
    private client_id!: string;
    private service_id!: string;
    private start_time!: Date;
    private end_time!: Date;
    private status: AppointmentStatus = AppointmentStatus.PENDING;
    private client_note?: string;
    private admin_note?: string;
    private created_at?: Date;
    private updated_at?: Date;
    public static newBuilder(): AppointmentBuilder {
        return new AppointmentBuilder();
    }
    public setClientId(client_id: string): AppointmentBuilder {
        this.client_id = client_id;
        return this;
    }
    public setServiceId(service_id: string): AppointmentBuilder {
        this.service_id = service_id;
        return this;
    }
    public setStartTime(start_time: Date): AppointmentBuilder {
        this.start_time = start_time;
        return this;
    }
    public setEndTime(end_time: Date): AppointmentBuilder {
        this.end_time = end_time;
        return this;
    }
    public setStatus(status: AppointmentStatus): AppointmentBuilder {
        this.status = status;
        return this;
    }
    public setClientNote(client_note: string): AppointmentBuilder {
        this.client_note = client_note;
        return this;
    }
    public setAdminNote(admin_note: string): AppointmentBuilder {
        this.admin_note = admin_note;
        return this;
    }
    public setCreatedAt(created_at: Date): AppointmentBuilder {
        this.created_at = created_at;
        return this;
    }
    public setUpdatedAt(updated_at: Date): AppointmentBuilder {
        this.updated_at = updated_at;
        return this;
    }
    public build(): Appointment {
        const requiredFields = [this.client_id, this.service_id, this.start_time, this.end_time];
        for (const field of requiredFields) {
            if (field === undefined) {
                logger.error("Missing required field for Appointment");
                throw new Error("Missing required field for Appointment");
            }
        }
        return new Appointment(this.id, this.client_id, this.service_id, this.start_time, this.end_time, this.status, this.client_note, this.admin_note, this.created_at, this.updated_at);
    }
}