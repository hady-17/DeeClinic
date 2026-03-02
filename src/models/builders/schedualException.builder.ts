import logger from "../../utils/logger";
import { ScheduleException } from "../schedualException.model";
import { v4 as uuidv4 } from "uuid";
/**id: string;
    date: Date;
    is_closed: boolean;
    open_time?: string;
    close_time?: string;
    note?: string; */
export class ScheduleExceptionBuilder {
    private id: string = uuidv4();
    private date: Date = new Date();
    private is_closed: boolean = false;
    private open_time?: string;
    private close_time?: string;
    private note?: string;
    public static newBuilder(): ScheduleExceptionBuilder {
        return new ScheduleExceptionBuilder();
    }
    public setDate(date: Date): ScheduleExceptionBuilder {
        this.date = date;
        return this;
    }
    public setIsClosed(is_closed: boolean): ScheduleExceptionBuilder {
        this.is_closed = is_closed;
        return this;
    }
    public setOpenTime(open_time: string): ScheduleExceptionBuilder {
        this.open_time = open_time;
        return this;
    }
    public setCloseTime(close_time: string): ScheduleExceptionBuilder {
        this.close_time = close_time;
        return this;
    }
    public setNote(note: string): ScheduleExceptionBuilder {
        this.note = note;
        return this;
    }
    public build(): ScheduleException {
        logger.info("Building ScheduleException with id: " + this.id);
        return new ScheduleException(this.id, this.date, this.is_closed, this.open_time, this.close_time, this.note);
    }
}