import logger from "../../utils/logger";
import { User } from "../../models/user.model";
import { v4 as uuidv4 } from "uuid";
import { UserRole, UserStatus } from "../../models/enums";
/**id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole = UserRole.RECEPTIONIST;
    status: UserStatus = UserStatus.INACTIVE;
    created_at?: Date; */
export class UserBuilder {
    private id : string = uuidv4();
    private name!: string ;
    private email!: string;
    private password_hash!: string;
    private role = UserRole.RECEPTIONIST;
    private status = UserStatus.INACTIVE;
    private created_at: Date = new Date();
    public static newBuilder(): UserBuilder {
        return new UserBuilder();
    }
    public setName(name: string): UserBuilder {
        this.name = name;
        return this;
    }
    public setEmail(email: string): UserBuilder {
        this.email = email;
        return this;
    }
    public setPasswordHash(password_hash: string): UserBuilder {
        this.password_hash = password_hash;
        return this;
    }
    public setRole(role: UserRole): UserBuilder {
        this.role = role;
        return this;
    }
    public setStatus(status: UserStatus): UserBuilder {
        this.status = status;
        return this;
    }
    public setCreatedAt(created_at: Date): UserBuilder {
        this.created_at = created_at;
        return this;
    }
    public build(): User {
        const requiredFields = [this.name, this.email, this.password_hash];
        if (requiredFields.some(field => field === undefined)) {
            logger.error("Missing required fields for User creation");
            throw new Error("Missing required fields for User creation");
        }
        return new User(this.id, this.name, this.email, this.password_hash, this.role, this.status, this.created_at);
    }
}