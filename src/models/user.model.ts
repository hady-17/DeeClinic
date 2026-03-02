/**`users` (admin only in MVP)

* `id`
* `email`
* `password_hash`
* `role` (ADMIN) */
import { UserRole ,UserStatus} from "./enums";

export interface IUser {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    status : UserStatus;
    created_at?: Date;
}

export class User implements IUser {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole = UserRole.RECEPTIONIST;
    status: UserStatus = UserStatus.INACTIVE;
    created_at?: Date;

    constructor(id: string, name: string, email: string, password_hash: string, role?: UserRole, status?: UserStatus, created_at?: Date) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password_hash = password_hash;
        this.role = role || UserRole.RECEPTIONIST;
        this.status = status || UserStatus.INACTIVE;
        this.created_at = created_at;
    }
    getId(): string {
        return this.id;
    }
    getName(): string {
        return this.name;
    }
    getEmail(): string {
        return this.email;
    }
    getPasswordHash(): string {
        return this.password_hash;
    }
    getRole(): UserRole {
        return this.role;
    }
    getStatus(): UserStatus {
        return this.status;
    }
    getCreatedAt(): Date | undefined {
        return this.created_at;
    }
}