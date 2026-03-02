import logger from "../../utils/logger";
import { Service } from "../services.model";
import { v4 as uuidv4 } from "uuid";
import { serviceStatus } from "../enums";
/**id: string
    name: string;
    description: string;
    image_url?: string;
    price: number;
    cost_price: number;
    duration_minutes: number;
    status?: serviceStatus = serviceStatus.ACTIVE;
    created_at?: Date; */
export class ServiceBuilder {
    private id: string = uuidv4();
    private name!: string;
    private description!: string;
    private image_url?: string;
    private price!: number;
    private cost_price!: number;
    private duration_minutes!: number;
    private status: serviceStatus = serviceStatus.ACTIVE;
    private created_at: Date = new Date();
    public static newBuilder(): ServiceBuilder {
        return new ServiceBuilder();
    }
    public setName(name: string): ServiceBuilder {
        this.name = name;
        return this;
    }
    public setDescription(description: string): ServiceBuilder {
        this.description = description;
        return this;
    }
    public setImageUrl(image_url: string): ServiceBuilder {
        this.image_url = image_url;
        return this;
    }
    public setPrice(price: number): ServiceBuilder {
        this.price = price;
        return this;
    }
    public setCostPrice(cost_price: number): ServiceBuilder {
        this.cost_price = cost_price;
        return this;
    }
    public setDurationMinutes(duration_minutes: number): ServiceBuilder {
        this.duration_minutes = duration_minutes;
        return this;
    }
    public setStatus(status: serviceStatus): ServiceBuilder {
        this.status = status;
        return this;
    }
    public setCreatedAt(created_at: Date): ServiceBuilder {
        this.created_at = created_at;
        return this;
    }
    public build(): Service {
        const requiredFields = [this.name, this.description, this.price, this.cost_price, this.duration_minutes];
        if (requiredFields.some(field => field === undefined)) {
            logger.error("Missing required fields for Service creation");
            throw new Error("Missing required fields for Service creation");
        }
        return new Service(this.id, this.name, this.description, this.price, this.cost_price, this.duration_minutes, this.status, this.created_at, this.image_url);
    }
}