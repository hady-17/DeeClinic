import logger from "./utils/logger";
import { UserBuilder } from "./models/builders/user.builder";
import { ClientBuilder } from "./models/builders/client.builder";
import { AppointmentBuilder } from "./models/builders/appointment.builder";
import { ServiceBuilder } from "./models/builders/services.builder";
import { OfferBuilder } from "./models/builders/offer.builder";
import { FeedbackBuilder } from "./models/builders/feedback.builder";
import { ClinicScheduleBuilder } from "./models/builders/clinicSchedual.builder";
import { ScheduleExceptionBuilder } from "./models/builders/schedualException.builder";
import { WhatsappMessageBuilder } from "./models/builders/whatsappMessage.builder";
import { UserRole, UserStatus, AppointmentStatus, offerType } from "./models/enums";
import { FeedbackRating } from "./models/feedback.model";
import { Weekday } from "./models/clinicSchedual.model";
import { whatsAppMessageType, whatsAppMessageStatus } from "./models/whatsappMessage.model";
import { NeonUserRepository } from "./repository/neon/user.repository";
import { NeonClientRepository } from "./repository/neon/client.repository";
import { WhatsAppMessageRepository } from "./repository/neon/whatsappMessage.repositoy";
import { NeonClinicScheduleRepository } from "./repository/neon/clinicSchedual.repository";
import { NeonFeedbackRepository } from "./repository/neon/feedback.repository";
import { AppointmentRepository } from "./repository/neon/appointment.repository";
import {v4 as uuidv4} from "uuid";

async function main() {
    const userNeonRepo = new NeonUserRepository();
    const clientNeonRepo = new NeonClientRepository();
    const whatsAppMsgNeonRepo = new WhatsAppMessageRepository();
    const clinicScheduleNeonRepo = new NeonClinicScheduleRepository();
    const appointmentNeonRepo = new AppointmentRepository();
    const feedbackNeonRepo = new NeonFeedbackRepository();
    try {
        const randomId = Math.random().toString(36).substring(2, 15);
        const user = new UserBuilder()
            .setName("Alice")
            .setEmail(`test${randomId}@example.com`)
            .setPasswordHash("hashedpassword")
            .setRole(UserRole.RECEPTIONIST)
            .setStatus(UserStatus.INACTIVE)
            .build();
        const client = new ClientBuilder()
            .setId(uuidv4()) // Optionally set a specific ID, or let it be generated
            .setName("Bob")
            .setPhone("+1234567890")
            .build();
        
        const appointment = new AppointmentBuilder()
        .setClientId(client.id) // Use the ID of the created client
        .setServiceId("service-123")
        .setStartTime(new Date())
        .setEndTime(new Date(Date.now() + 60 * 60 * 1000)) // 1 hour later
        .setStatus(AppointmentStatus.CONFIRMED)
        .setClientNote("Looking forward to it!")
        .setAdminNote("First appointment with this client.")
        .build();
        const clientId = await clientNeonRepo.create(client);
        logger.info(`Client created with ID: ${clientId}`);
        const appointmentId = await appointmentNeonRepo.create(appointment);
        logger.info(`Appointment created with ID: ${appointmentId}`);
        logger.info(`appointment was done by client with ID: ${appointment.client_id}`);
    } catch (err) {
        logger.error("Error during repository operations", err);
    }
}

main();

