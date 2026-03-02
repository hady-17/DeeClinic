/*** `id`
* `title`
* `type` (DISCOUNT | COMBO)
* `price`
* `service_ids` (for combo, stored in join table in real design)
* `duration_minutes` (if combo is bookable as one slot)
* `start_date`, `end_date`
* `active` */
import { offerType } from "./enums";

export enum offerStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    EXPIRED = "EXPIRED"
}

export interface IOffer {
    id: string;
    title: string;
    type: offerType;
    price: number;
    service_ids: string[];
    duration_minutes?: number;
    start_date: Date;
    end_date: Date;
    active: offerStatus;
}

export class Offer implements IOffer {
    id: string;
    title: string;
    type: offerType;
    price: number;
    service_ids: string[];
    duration_minutes?: number;
    start_date: Date;
    end_date: Date;
    active: offerStatus = offerStatus.ACTIVE;
    constructor(id: string, title: string, type: offerType, price: number, service_ids: string[], start_date: Date, end_date: Date, duration_minutes?: number, active?: offerStatus) {
        this.id = id;
        this.title = title;
        this.type = type;
        this.price = price;
        this.service_ids = service_ids;
        this.start_date = start_date;
        this.end_date = end_date;
        this.duration_minutes = duration_minutes;
        this.active = active || offerStatus.ACTIVE;
    }
    getId(): string {
        return this.id;
    }
    getTitle(): string {
        return this.title;
    }
    getType(): offerType {
        return this.type;
    }
    getPrice(): number {
        return this.price;
    }
    getServiceIds(): string[] {
        return this.service_ids;
    }
    getDurationMinutes(): number | undefined {
        return this.duration_minutes;
    }
    getStartDate(): Date {
        return this.start_date;
    }
    getEndDate(): Date {
        return this.end_date;
    }
    getActiveStatus(): offerStatus {
        return this.active;
    }
}