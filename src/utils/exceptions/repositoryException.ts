

export class ItemNotFoundException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ItemNotFoundException";
    }
}

export class InvalidItemException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidItemException";
    }
}


export class InitializationException extends Error {
    constructor(message: string , error : Error) {
        super(message);
        this.name = "InitializationException";
        this.stack = error.stack;
        this.message = `${message} - Caused by: ${error.message}`;
    }
}

export class DBexception extends Error {
    constructor(message: string , error : Error) {
        super(message);
        this.name = "DBexception";
        this.stack = error.stack;
        this.message = `${message} - Caused by: ${error.message}`;
    }
}
