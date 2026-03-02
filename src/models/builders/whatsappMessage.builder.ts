import logger from "../../utils/logger";
import {WhatsAppMessage } from "../whatsappMessage.model";
import { v4 as uuidv4 } from "uuid";
import { whatsAppMessageStatus, whatsAppMessageType } from "../whatsappMessage.model";
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
export class WhatsappMessageBuilder {
    private id: string = uuidv4();
    private appointment_id!: string;
    private type!: whatsAppMessageType;
    private to_phone!: string;
    private payload_json!: string;
    private status!: whatsAppMessageStatus;
    private scheduled_for!: Date;
    private sent_at?: Date;
    public static newBuilder(): WhatsappMessageBuilder {
        return new WhatsappMessageBuilder();
    }
    public setAppointmentId(appointment_id: string): WhatsappMessageBuilder {
        this.appointment_id = appointment_id;
        return this;
    }
    public setType(type: whatsAppMessageType): WhatsappMessageBuilder {
        this.type = type;
        return this;
    }
    public setToPhone(to_phone: string): WhatsappMessageBuilder {
        this.to_phone = to_phone;
        return this;
    }
    public setPayloadJson(payload_json: string): WhatsappMessageBuilder {
        this.payload_json = payload_json;
        return this;
    }
    public setStatus(status: whatsAppMessageStatus): WhatsappMessageBuilder {
        this.status = status;
        return this;
    }
    public setScheduledFor(scheduled_for: Date): WhatsappMessageBuilder {
        this.scheduled_for = scheduled_for;
        return this;
    }
    public setSentAt(sent_at: Date): WhatsappMessageBuilder {
        this.sent_at = sent_at;
        return this;
    }
    public build(): WhatsAppMessage {
        const requiredFields = [this.appointment_id, this.type, this.to_phone, this.payload_json, this.status, this.scheduled_for];
        if (requiredFields.some(field => field === undefined)) {
            logger.error("Missing required fields for WhatsappMessage creation");
            throw new Error("Missing required fields for WhatsappMessage creation");
        }
        return new WhatsAppMessage(this.id, this.appointment_id, this.type, this.to_phone, this.payload_json, this.status, this.scheduled_for, this.sent_at);
    }
}
