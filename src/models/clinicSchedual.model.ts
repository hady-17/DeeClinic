import { UserStatus } from "./enums";

/*** `id`
* `weekday` (0-6)
* `open_time`
* `close_time`
* `slot_step_minutes` (optional, default 15)
* `active` */
 export enum Weekday {
    SUNDAY = 0,
    MONDAY = 1,
    TUESDAY = 2,
    WEDNESDAY = 3,
    THURSDAY = 4,
    FRIDAY = 5,
    SATURDAY = 6
}

export interface IClinicSchedule {
    id: string;
    weekday: Weekday;
    open_time: string; // "HH:mm"
    close_time: string; // "HH:mm"
    slot_step_minutes?: number; // default 15
    active: UserStatus;
}

export class ClinicSchedule implements IClinicSchedule {
    id: string;
    weekday: Weekday;
    open_time: string;
    close_time: string;
    slot_step_minutes: number;
    active: UserStatus= UserStatus.ACTIVE;
    constructor(id: string, weekday: Weekday, open_time: string, close_time: string, active: UserStatus , slot_step_minutes: number = 15) {
        this.id = id;
        this.weekday = weekday;
        this.open_time = open_time;
        this.close_time = close_time;
        this.slot_step_minutes = slot_step_minutes;
        this.active = active;
    }
    getId(): string {
        return this.id;
    }
    getWeekday(): Weekday {
        return this.weekday;
    }
    getOpenTime(): string {
        return this.open_time;
    }
    getCloseTime(): string {
        return this.close_time;
    }
    getSlotStepMinutes(): number {
        return this.slot_step_minutes;
    }
    getActive(): UserStatus {
        return this.active;
    }
}
