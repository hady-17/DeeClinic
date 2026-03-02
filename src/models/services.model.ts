/*** `id`
* `name`
* `description`
* `price` (sale price)
* `cost_price`
* `duration_minutes`
* `status` (enum: ACTIVE, INACTIVE, DELETED, LIQUIDATED)
* `created_at` */
import { serviceStatus } from "./enums";

export interface IService {
    id: string;
    name: string;
    description: string;
    image_url?: string;
    price: number;
    cost_price: number;
    duration_minutes: number;
    status?: serviceStatus;
    created_at?: Date;
}

export class Service implements IService {
    id: string
    name: string;
    description: string;
    image_url?: string;
    price: number;
    cost_price: number;
    duration_minutes: number;
    status?: serviceStatus = serviceStatus.ACTIVE;
    created_at?: Date;
    constructor(id: string, name: string, description: string, price: number, cost_price: number, duration_minutes: number, status: serviceStatus = serviceStatus.ACTIVE, created_at?: Date, image_url?: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.cost_price = cost_price;
        this.duration_minutes = duration_minutes;
        this.status = status;
        this.created_at = created_at;
        this.image_url = image_url;
    }
    getId(): string {
        return this.id;
    }
    getName(): string {
        return this.name;
    }
    getDescription(): string {
        return this.description;
    }
    getImageUrl(): string | undefined {
        return this.image_url;
    }
    getPrice(): number {
        return this.price;
    }
    getCostPrice(): number {
        return this.cost_price;
    }
    getDurationMinutes(): number {
        return this.duration_minutes;
    }
    getStatus(): serviceStatus | undefined {
        return this.status;
    }
    getCreatedAt(): Date | undefined {
        return this.created_at;
    }
}