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
import { AppointmentRepository } from "./repository/neon/appointment.repository";
import { FeedbackRepository } from "./repository/neon/feedback.repository";
import { OfferRepository } from "./repository/neon/offer.repository";

// Create a User instance
const randomNum = Math.floor(Math.random() * 100);
const user = UserBuilder.newBuilder()
    .setName("John Doe")
    .setEmail(`john${randomNum}@example.com`)
    .setPasswordHash("hashed_password_123")
    .setRole(UserRole.DOCTOR)
    .setStatus(UserStatus.ACTIVE)
    .build();

logger.info(`User created: ${user.getName ? user.getName() : user.name} (${user.getEmail ? user.getEmail() : user.email})`);

// Create a Client instance
const client = ClientBuilder.newBuilder()
    .setName("Ahmed Hassan")
    .setPhone("+966123456789")
    .setCreatedAt(new Date())
    .build();

logger.info(`Client created: ${client.getName ? client.getName() : client.name} (${client.getPhone ? client.getPhone() : client.phone})`);

// Create a Service instance
const service = ServiceBuilder.newBuilder()
    .setName("Dental Cleaning")
    .setDescription("Standard dental cleaning")
    .setPrice(150)
    .setCostPrice(80)
    .setDurationMinutes(30)
    .build();

logger.info(`Service created: ${service.getName ? service.getName() : service.name}`);

// Create an Appointment instance
const appointment = AppointmentBuilder.newBuilder()
    .setClientId(client.getId ? client.getId() : client.id)
    .setServiceId(service.getId ? service.getId() : (service.id || "service-001"))
    .setStartTime(new Date("2026-03-15T10:00:00"))
    .setEndTime(new Date("2026-03-15T10:30:00"))
    .setStatus(AppointmentStatus.PENDING)
    .setClientNote("Please be on time")
    .build();

logger.info(`Appointment created for client ${appointment.getClientId ? appointment.getClientId() : appointment.client_id}`);

// Create an Offer instance
const offer = OfferBuilder.newBuilder()
    .setTitle("Spring Discount")
    .setType(offerType.DISCOUNT)
    .setPrice(120)
    .setServiceIds([service.getId ? service.getId() : (service.id || "service-001")])
    .setStartDate(new Date("2026-03-01"))
    .setEndDate(new Date("2026-04-30"))
    .build();

logger.info(`Offer created: ${offer.getTitle ? offer.getTitle() : offer.title}`);

// Create a Feedback instance
const feedback = FeedbackBuilder.newBuilder()
    .setAppointmentId(appointment.getId ? appointment.getId() : appointment.id)
    .setRating(FeedbackRating.FIVE)
    .setComment("Excellent service!")
    .build();

logger.info(`Feedback created: ${feedback.getRating ? feedback.getRating() : feedback.rating} for appointment ${feedback.getAppointmentId ? feedback.getAppointmentId() : feedback.appointment_id}`);

// Create a Clinic Schedule instance
const scheduleEntry = ClinicScheduleBuilder.newBuilder()
    .setWeekday(Weekday.MONDAY)
    .setOpenTime("08:00")
    .setCloseTime("17:00")
    .setSlotStepMinutes(15)
    .build();

logger.info(`Schedule created: ${scheduleEntry.getWeekday ? scheduleEntry.getWeekday() : scheduleEntry.weekday} - ${scheduleEntry.getOpenTime ? scheduleEntry.getOpenTime() : scheduleEntry.open_time} to ${scheduleEntry.getCloseTime ? scheduleEntry.getCloseTime() : scheduleEntry.close_time}`);

// Create a Schedule Exception instance
const scheduleException = ScheduleExceptionBuilder.newBuilder()
    .setDate(new Date("2026-03-25"))
    .setNote("National Holiday")
    .setIsClosed(true)
    .build();

logger.info(`Exception created on ${scheduleException.getDate ? scheduleException.getDate() : scheduleException.date}`);

// Create a WhatsApp Message instance
const whatsappMsg = WhatsappMessageBuilder.newBuilder()
    .setAppointmentId(appointment.getId ? appointment.getId() : appointment.id)
    .setType(whatsAppMessageType.APPOINTMENT_REMINDER)
    .setToPhone(client.getPhone ? client.getPhone() : client.phone)
    .setPayloadJson(JSON.stringify({ text: "Your appointment is confirmed for tomorrow at 10:00 AM" }))
    .setStatus(whatsAppMessageStatus.SENT)
    .setScheduledFor(new Date())
    .build();

logger.info(`WhatsApp message created for appointment ${whatsappMsg.getAppointmentId ? whatsappMsg.getAppointmentId() : whatsappMsg.appointment_id}`);
logger.info("------------------------------------------");

async function main() {
    const userNeonRepo = new NeonUserRepository();
    const clientNeonRepo = new NeonClientRepository();
    const whatsAppMsgNeonRepo = new WhatsAppMessageRepository();
    const clinicScheduleNeonRepo = new NeonClinicScheduleRepository();
    const appointmentNeonRepo = new AppointmentRepository(); // Placeholder for Appointment repository
    const feedbackNeonRepo = new FeedbackRepository(); // Placeholder for Feedback repository
    const offerNeonRepo = new OfferRepository(); // Placeholder for Offer repository
    try {
        await userNeonRepo.init();
        await clientNeonRepo.init();
        await whatsAppMsgNeonRepo.init();
        await clinicScheduleNeonRepo.init();
        await appointmentNeonRepo.init();
        await feedbackNeonRepo.init();
        await offerNeonRepo.init();
        logger.info("User repository initialized successfully.");
        const userId = await userNeonRepo.create(user);
        logger.info(`User created with ID: ${userId}`);
        /**const fetched = await userNeonRepo.getById(userId);
        logger.info(`Fetched user: ${fetched.getEmail()}`);
        const fetchedByEmail = await userNeonRepo.getbyEmail(fetched.getEmail());
        logger.info(`Fetched by email: ${fetchedByEmail.getName()}`);
        const allUsers = await userNeonRepo.getAll();
        logger.info(`Total users in database: ${allUsers.length}`);
        const  user_1 = new UserBuilder()
            .setName("John Doe Updated")
            .setEmail(user.getEmail())
            .setPasswordHash(user.getPasswordHash())
            .setRole(user.getRole())
            .setStatus(user.getStatus())
            .build();
        await userNeonRepo.update(userId, user_1);*/
        logger.info("----------------------------------");
        const clientId = await clientNeonRepo.create(client);
        logger.info(`Client created with ID: ${clientId}`);
        /**const fetchedClient = await clientNeonRepo.getById(clientId);
        logger.info(`Fetched client: ${fetchedClient.name}`);
        const allClients = await clientNeonRepo.getAll();
        logger.info(`Total clients in database: ${allClients.length}`);
        const client_1 = new ClientBuilder()
            .setName("Ahmed Hassan Updated")
            .setPhone(client.getPhone())
            .build();
        await clientNeonRepo.update(clientId, client_1);*/
        logger.info("----------------------------------");
        const appointmentId = await appointmentNeonRepo.create(appointment);
        logger.info(`Appointment created with ID: ${appointmentId}`);
        const fetchedAppointment = await appointmentNeonRepo.getById(appointmentId);
        logger.info(`Fetched appointment for client ID: ${fetchedAppointment.client_id}`);
        logger.info("----------------------------------");
        const whatsappMsgId = await whatsAppMsgNeonRepo.create(whatsappMsg);
        logger.info(`WhatsAppMessage created with ID: ${whatsappMsgId}`);
        const fetchedMsg = await whatsAppMsgNeonRepo.getById(whatsappMsgId);
        logger.info(`Fetched WhatsAppMessage for appointment ID: ${fetchedMsg.appointment_id}`);
        const allMessages = await whatsAppMsgNeonRepo.getAll();
        logger.info(`Total WhatsAppMessages in database: ${allMessages.length}`);
        logger.info("----------------------------------");
        const scheduleId = await clinicScheduleNeonRepo.create(scheduleEntry);
        logger.info(`ClinicSchedule created with ID: ${scheduleId}`);
        const fetchedSchedule = await clinicScheduleNeonRepo.getById(scheduleId);
        logger.info(`Fetched ClinicSchedule for weekday: ${fetchedSchedule.weekday}`);
        const allSchedules = await clinicScheduleNeonRepo.getAll();
        logger.info(`Total ClinicSchedules in database: ${allSchedules.length}`);
        const feedbackId = await feedbackNeonRepo.create(feedback);
        logger.info(`Feedback created with ID: ${feedbackId}`);
        const fetchedFeedback = await feedbackNeonRepo.getById(feedbackId);
        logger.info(`Fetched Feedback for appointment ID: ${fetchedFeedback.appointment_id}`);
        const allFeedbacks = await feedbackNeonRepo.getAll();
        logger.info(`Total Feedbacks in database: ${allFeedbacks.length}`);
        const offerId = await offerNeonRepo.create(offer);
        logger.info(`Offer created with ID: ${offerId}`);
        const fetchedOffer = await offerNeonRepo.getById(offerId);
        logger.info(`Fetched Offer with title : ${fetchedOffer}`);


    } catch (err) {
        logger.error("Error during repository operations", err);
    }
}

main();

export { user, client, appointment, service, offer, feedback, scheduleEntry, scheduleException, whatsappMsg };
