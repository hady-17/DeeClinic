/*** `id`
* `name`
* `phone` (unique-ish, but allow duplicates safely)
* `created_at` */

export interface IClient {
    id: string;
    name: string;
    phone: string;
    created_at?: Date;
}
export class Client implements IClient {
    id: string;
    name: string;
    phone: string;
    created_at?: Date;
    constructor(id: string, name: string, phone: string, created_at?: Date) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.created_at = created_at;
    }
    getId(): string {
        return this.id;
    }
    getName(): string {
        return this.name;
    }
    getPhone(): string {
        return this.phone;
    }
    getCreatedAt(): Date | undefined {
        return this.created_at;
    }
}