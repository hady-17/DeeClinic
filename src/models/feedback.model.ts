/**
* `id`
* `appointment_id`
* `rating` (1-5)
* `comment`
* `created_at` */
export enum FeedbackRating {
    ONE = 1,
    TWO = 2,
    THREE = 3,
    FOUR = 4,
    FIVE = 5
}
export interface IFeedback {
    id: string;
    appointment_id: string;
    rating: FeedbackRating;
    comment?: string;
    created_at?: Date;
}
export class Feedback implements IFeedback {
    id: string;
    appointment_id: string;
    rating: FeedbackRating;
    comment?: string;
    created_at?: Date;
    constructor(id: string, appointment_id: string, rating: FeedbackRating, comment?: string, created_at?: Date) {
        this.id = id;
        this.appointment_id = appointment_id;
        this.rating = rating;
        this.comment = comment;
        this.created_at = created_at;
    }
    getId(): string {
        return this.id;
    }
    getAppointmentId(): string {
        return this.appointment_id;
    }
    getRating(): FeedbackRating {
        return this.rating;
    }
    getComment(): string | undefined {
        return this.comment;
    }
    getCreatedAt(): Date | undefined {
        return this.created_at;
    }
}