import logger from "../../utils/logger";
import { ClinicSchedule,Weekday } from "../../models/clinicSchedual.model";
import { UserStatus } from "../../models/enums";
import { v4 as uuidv4 } from "uuid";
/**id: string;
    weekday: Weekday;
    open_time: string;
    close_time: string;
    slot_step_minutes: number;
    active: UserStatus= UserStatus.ACTIVE; */
export class ClinicScheduleBuilder {
    private id: string = uuidv4();
    private weekday!: Weekday;
    private open_time!: string;
    private close_time!: string;
    private slot_step_minutes: number = 15;
    private active: UserStatus = UserStatus.ACTIVE;
    public static newBuilder(): ClinicScheduleBuilder {
        return new ClinicScheduleBuilder();
    }
    public setWeekday(weekday: Weekday): ClinicScheduleBuilder {
        this.weekday = weekday;
        return this;
    }
    public setOpenTime(open_time: string): ClinicScheduleBuilder {
        this.open_time = open_time;
        return this;
    }
    public setCloseTime(close_time: string): ClinicScheduleBuilder {
        this.close_time = close_time;
        return this;
    }
    public setSlotStepMinutes(slot_step_minutes: number): ClinicScheduleBuilder {
        this.slot_step_minutes = slot_step_minutes;
        return this;
    }
    public setActive(active: UserStatus): ClinicScheduleBuilder {
        this.active = active;
        return this;
    }
    public build(): ClinicSchedule {
        const requiredFields = [this.weekday, this.open_time, this.close_time];
        for (const field of requiredFields) {
            if (field === undefined) {
                logger.error("Missing required field for ClinicSchedule");
                throw new Error("Missing required field for ClinicSchedule");
            }
        }
        return new ClinicSchedule(this.id, this.weekday, this.open_time, this.close_time, this.active, this.slot_step_minutes);
    }
}