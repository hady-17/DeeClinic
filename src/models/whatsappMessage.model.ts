/*** `id`
* `appointment_id`
* `type` (CONFIRMATION | REMINDER | FEEDBACK)
* `to_phone`
* `payload_json`
* `status` (QUEUED | SENT | FAILED)
* `scheduled_for`
* `sent_at` */

export enum whatsAppMessageType {
    APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER",
    APPOINTMENT_CONFIRMATION = "APPOINTMENT_CONFIRMATION",
    APPOINTMENT_CANCELLATION = "APPOINTMENT_CANCELLATION",
    APPOINTMENT_RESCHEDULE = "APPOINTMENT_RESCHEDULE",
    FOLLOW_UP = "FOLLOW_UP",
    PROMOTIONAL = "PROMOTIONAL"
}
export enum whatsAppMessageStatus {
    SENT = "SENT",
    DELIVERED = "DELIVERED",
    READ = "READ",
    FAILED = "FAILED"
}

export interface IWhatsAppMessage {
    id: string;
    appointment_id: string;
    type: whatsAppMessageType;
    to_phone: string;
    payload_json: string;
    status: whatsAppMessageStatus;
    scheduled_for: Date;
    sent_at?: Date;
}
export class WhatsAppMessage implements IWhatsAppMessage {
    id: string;
    appointment_id: string;
    type: whatsAppMessageType;
    to_phone: string;
    payload_json: string;
    status: whatsAppMessageStatus;
    scheduled_for: Date;
    sent_at?: Date;
    constructor(id: string, appointment_id: string, type: whatsAppMessageType, to_phone: string, payload_json: string, status: whatsAppMessageStatus, scheduled_for: Date, sent_at?: Date) {
        this.id = id;
        this.appointment_id = appointment_id;
        this.type = type;
        this.to_phone = to_phone;
        this.payload_json = payload_json;
        this.status = status;
        this.scheduled_for = scheduled_for;
        this.sent_at = sent_at;
    }
    getId(): string {
        return this.id;
    }
    getAppointmentId(): string {
        return this.appointment_id;
    }
    getType(): whatsAppMessageType {
        return this.type;
    }
    getToPhone(): string {
        return this.to_phone;
    }
    getPayloadJson(): string {
        return this.payload_json;
    }
    getStatus(): whatsAppMessageStatus {
        return this.status;
    }
    getScheduledFor(): Date {
        return this.scheduled_for;
    }
    getSentAt(): Date | undefined {
        return this.sent_at;
    }
}