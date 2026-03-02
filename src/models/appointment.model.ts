/**
* `id`
* `client_id`
* `service_id` (or offer_id)
* `start_time` (timestamp)
* `end_time` (timestamp)
* `status` (PENDING | CONFIRMED | CANCELLED_BY_CLIENT | CANCELLED_BY_ADMIN | DONE | NO_SHOW)
* `client_note`
* `admin_note`
* `created_at`, `updated_at` */

export enum AppointmentStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    CANCELLED_BY_CLIENT = "CANCELLED_BY_CLIENT",
    CANCELLED_BY_ADMIN = "CANCELLED_BY_ADMIN",
    DONE = "DONE",
    NO_SHOW = "NO_SHOW"
}
export interface IAppointment {
    id: string;
    client_id: string;
    service_id: string; // or offer_id
    start_time: Date;
    end_time: Date;
    status: AppointmentStatus;
    client_note?: string;
    admin_note?: string;
    created_at?: Date;
    updated_at?: Date;
}
export class Appointment implements IAppointment {
    id: string;
    client_id: string;
    service_id: string;
    start_time: Date;
    end_time: Date;
    status: AppointmentStatus = AppointmentStatus.PENDING;
    client_note?: string;
    admin_note?: string;
    created_at?: Date;
    updated_at?: Date;
    constructor(id: string, client_id: string, service_id: string, start_time: Date, end_time: Date, status?: AppointmentStatus, client_note?: string, admin_note?: string, created_at?: Date, updated_at?: Date) {
        this.id = id;
        this.client_id = client_id;
        this.service_id = service_id;
        this.start_time = start_time;
        this.end_time = end_time;
        this.status = status || AppointmentStatus.PENDING;
        this.client_note = client_note;
        this.admin_note = admin_note;
        this.created_at = created_at;
        this.updated_at = updated_at;
    }
    getId(): string {
        return this.id;
    }
    getClientId(): string {
        return this.client_id;
    }
    getServiceId(): string {
        return this.service_id;
    }
    getStartTime(): Date {
        return this.start_time;
    }
    getEndTime(): Date {
        return this.end_time;
    }
    getStatus(): AppointmentStatus {
        return this.status;
    }
    getClientNote(): string | undefined {
        return this.client_note;
    }
    getAdminNote(): string | undefined {
        return this.admin_note;
    }
    getCreatedAt(): Date | undefined {
        return this.created_at;
    }
    getUpdatedAt(): Date | undefined {
        return this.updated_at;
    }
}