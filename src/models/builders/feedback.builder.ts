import logger from "../../utils/logger";
import { Feedback, FeedbackRating } from "../feedback.model";
import { v4 as uuidv4 } from "uuid";
/**id: string;
    appointment_id: string;
    rating: FeedbackRating;
    comment?: string;
    created_at?: Date; */
export class FeedbackBuilder {
    private id: string = uuidv4()
    private appointment_id!: string;
    private rating!: FeedbackRating;
    private comment?: string;
    private created_at?: Date;
    public static newBuilder(): FeedbackBuilder {
        return new FeedbackBuilder();
    }
    public setAppointmentId(appointment_id: string): FeedbackBuilder {
        this.appointment_id = appointment_id;
        return this;
    }
    public setRating(rating: FeedbackRating): FeedbackBuilder {
        this.rating = rating;
        return this;
    }
    public setComment(comment: string): FeedbackBuilder {
        this.comment = comment;
        return this;
    }
    public setCreatedAt(created_at: Date): FeedbackBuilder {
        this.created_at = created_at;
        return this;
    }
    public build(): Feedback {
        const requiredFields = [this.appointment_id, this.rating];
        for (const field of requiredFields) {
            if (field === undefined) {
                logger.error("Missing required field for Feedback");
                throw new Error("Missing required field for Feedback");
            }
        }
        return new Feedback(this.id, this.appointment_id, this.rating, this.comment, this.created_at);
    }
}