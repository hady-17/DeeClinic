/*** `id`
* `date`
* `is_closed`
* `open_time` (nullable)
* `close_time` (nullable)
* `note` */

export interface IScheduleException {
    id: string;
    date: Date;
    is_closed: boolean;
    open_time?: string; // "HH:mm"
    close_time?: string; // "HH:mm"
    note?: string;
}
export class ScheduleException implements IScheduleException {
    id: string;
    date: Date;
    is_closed: boolean;
    open_time?: string;
    close_time?: string;
    note?: string;
    constructor(id: string, date: Date, is_closed: boolean, open_time?: string, close_time?: string, note?: string) {
        this.id = id;
        this.date = date;
        this.is_closed = is_closed;
        this.open_time = open_time;
        this.close_time = close_time;
        this.note = note;
    }
    getId(): string {
        return this.id;
    }
    getDate(): Date {
        return this.date;
    }
    getIsClosed(): boolean {
        return this.is_closed;
    }
    getOpenTime(): string | undefined {
        return this.open_time;
    }
    getCloseTime(): string | undefined {
        return this.close_time;
    }
    getNote(): string | undefined {
        return this.note;
    }
}