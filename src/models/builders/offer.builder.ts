import logger from "../../utils/logger";
import { offerStatus,Offer } from "../offer.model";
import { offerType } from "../enums";
import { v4 as uuidv4 } from "uuid";
/**id: string;
    title: string;
    type: offerType;
    price: number;
    service_ids: string[];
    duration_minutes?: number;
    start_date: Date;
    end_date: Date;
    active: offerStatus = offerStatus.ACTIVE; */
export class OfferBuilder {
    private id: string = uuidv4();
    private title!: string;
    private type!: offerType;
    private price!: number;
    private service_ids!: string[];
    private duration_minutes?: number;
    private start_date!: Date;
    private end_date!: Date;
    private active: offerStatus = offerStatus.ACTIVE;
    public static newBuilder(): OfferBuilder {
        return new OfferBuilder();
    }
    public setTitle(title: string): OfferBuilder {
        this.title = title;
        return this;
    }
    public setType(type: offerType): OfferBuilder {
        this.type = type;
        return this;
    }
    public setPrice(price: number): OfferBuilder {
        this.price = price;
        return this;
    }
    public setServiceIds(service_ids: string[]): OfferBuilder {
        this.service_ids = service_ids;
        return this;
    }
    public setDurationMinutes(duration_minutes: number): OfferBuilder {
        this.duration_minutes = duration_minutes;
        return this;
    }
    public setStartDate(start_date: Date): OfferBuilder {
        this.start_date = start_date;
        return this;
    }
    public setEndDate(end_date: Date): OfferBuilder {
        this.end_date = end_date;
        return this;
    }
    public setActive(active: offerStatus): OfferBuilder {
        this.active = active;
        return this;
    }
    public build(): Offer {
        const requiredFields = [this.title, this.type, this.price, this.service_ids, this.start_date, this.end_date];
        if (requiredFields.some(field => field === undefined)) {
            logger.error("Missing required fields for Offer");
            throw new Error("Missing required fields for Offer");
        }
        return new Offer(this.id, this.title, this.type, this.price, this.service_ids, this.start_date, this.end_date, this.duration_minutes, this.active);
    }
}
