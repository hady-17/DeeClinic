import logger from "../../utils/logger";
import { Client } from "../../models/client.model";
import { v4 as uuidv4 } from "uuid";
/**id: string;
    name: string;
    phone: string;
    created_at?: Date; */
export class ClientBuilder {
    private id!: string;
    private name!: string;
    private phone!: string;
    private created_at?: Date;
    public static newBuilder(): ClientBuilder {
        return new ClientBuilder();
    }
    public setId(id: string): ClientBuilder {
        this.id = id;
        return this;
    }
    public setName(name: string): ClientBuilder {
        this.name = name;
        return this;
    }
    public setPhone(phone: string): ClientBuilder {
        this.phone = phone;
        return this;
    }
    public setCreatedAt(created_at: Date): ClientBuilder {
        this.created_at = created_at;
        return this;
    }
    public build(): Client {   
         const requiredFields = [this.name, this.phone];
        for (const field of requiredFields) {
            if (field === undefined) {
                logger.error("Missing required field for Client");
                throw new Error("Missing required field for Client");
            }
        }
        return new Client(this.id, this.name, this.phone, this.created_at);
    }
}