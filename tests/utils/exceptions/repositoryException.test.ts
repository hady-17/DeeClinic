import {
    ItemNotFoundException,
    InvalidItemException,
    InitializationException,
    DBexception,
} from "../../../src/utils/exceptions/repositoryException";

describe("Custom Exceptions", () => {
    describe("ItemNotFoundException", () => {
        it("should create an instance with correct name", () => {
            const message = "Item not found";
            const error = new ItemNotFoundException(message);

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("ItemNotFoundException");
            expect(error.message).toBe(message);
        });

        it("should have proper error message", () => {
            const message = "User with ID 123 not found";
            const error = new ItemNotFoundException(message);

            expect(error.message).toBe(message);
        });

        it("should have stack trace", () => {
            const error = new ItemNotFoundException("Item not found");

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain("ItemNotFoundException");
        });

        it("should be catchable as Error", () => {
            const message = "Item not found";

            expect(() => {
                throw new ItemNotFoundException(message);
            }).toThrow(ItemNotFoundException);
        });
    });

    describe("InvalidItemException", () => {
        it("should create an instance with correct name", () => {
            const message = "Invalid item data";
            const error = new InvalidItemException(message);

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("InvalidItemException");
            expect(error.message).toBe(message);
        });

        it("should have proper error message", () => {
            const message = "Email format is invalid";
            const error = new InvalidItemException(message);

            expect(error.message).toBe(message);
        });

        it("should have stack trace", () => {
            const error = new InvalidItemException("Invalid data");

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain("InvalidItemException");
        });

        it("should be catchable as Error", () => {
            const message = "Invalid item";

            expect(() => {
                throw new InvalidItemException(message);
            }).toThrow(InvalidItemException);
        });
    });

    describe("InitializationException", () => {
        it("should create an instance with correct name", () => {
            const message = "Failed to initialize";
            const cause = new Error("Connection timeout");
            const error = new InitializationException(message, cause);

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("InitializationException");
        });

        it("should combine message with cause error message", () => {
            const message = "Database initialization failed";
            const cause = new Error("Port already in use");
            const error = new InitializationException(message, cause);

            expect(error.message).toBe("Database initialization failed - Caused by: Port already in use");
        });

        it("should preserve the original error stack", () => {
            const cause = new Error("Original error");
            const error = new InitializationException("Wrapper error", cause);

            expect(error.stack).toBe(cause.stack);
        });

        it("should handle multiple nested cause errors", () => {
            const rootCause = new Error("Root cause");
            const cause = new InitializationException("First wrapper", rootCause);
            const error = new InitializationException("Second wrapper", cause as any);

            expect(error.message).toContain("Second wrapper");
            expect(error.message).toContain("Caused by");
        });

        it("should be catchable as Error", () => {
            const cause = new Error("Cause");

            expect(() => {
                throw new InitializationException("Init failed", cause);
            }).toThrow(InitializationException);
        });

        it("should work with various cause error types", () => {
            const syntaxError = new SyntaxError("Invalid syntax");
            const error = new InitializationException("Failed to parse config", syntaxError);

            expect(error.message).toContain("Failed to parse config");
            expect(error.message).toContain("Invalid syntax");
        });
    });

    describe("DBexception", () => {
        it("should create an instance with correct name", () => {
            const message = "Database error occurred";
            const cause = new Error("Connection lost");
            const error = new DBexception(message, cause);

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("DBexception");
        });

        it("should combine message with cause error message", () => {
            const message = "Query execution failed";
            const cause = new Error("Syntax error in SQL");
            const error = new DBexception(message, cause);

            expect(error.message).toBe("Query execution failed - Caused by: Syntax error in SQL");
        });

        it("should preserve the original error stack", () => {
            const cause = new Error("Original DB error");
            const error = new DBexception("DB operation failed", cause);

            expect(error.stack).toBe(cause.stack);
        });

        it("should handle connection errors", () => {
            const cause = new Error("Connection refused");
            const error = new DBexception("Failed to connect to database", cause);

            expect(error.message).toContain("Failed to connect to database");
            expect(error.message).toContain("Connection refused");
        });

        it("should handle query timeout errors", () => {
            const cause = new Error("Query timeout after 30000ms");
            const error = new DBexception("Query execution timed out", cause);

            expect(error.message).toContain("Query execution timed out");
            expect(error.message).toContain("Query timeout");
        });

        it("should be catchable as Error", () => {
            const cause = new Error("Cause");

            expect(() => {
                throw new DBexception("DB error", cause);
            }).toThrow(DBexception);
        });

        it("should work with various cause error types", () => {
            const typeError = new TypeError("Connection is null");
            const error = new DBexception("Database operation failed", typeError);

            expect(error.message).toContain("Database operation failed");
            expect(error.message).toContain("Connection is null");
        });
    });

    describe("Exception Inheritance", () => {
        it("all exceptions should extend Error", () => {
            const itemError = new ItemNotFoundException("msg");
            const invalidError = new InvalidItemException("msg");
            const initError = new InitializationException("msg", new Error("cause"));
            const dbError = new DBexception("msg", new Error("cause"));

            expect(itemError).toBeInstanceOf(Error);
            expect(invalidError).toBeInstanceOf(Error);
            expect(initError).toBeInstanceOf(Error);
            expect(dbError).toBeInstanceOf(Error);
        });

        it("all exceptions should be distinguishable by name", () => {
            const errors = [
                new ItemNotFoundException("msg"),
                new InvalidItemException("msg"),
                new InitializationException("msg", new Error("cause")),
                new DBexception("msg", new Error("cause")),
            ];

            const names = errors.map((e) => e.name);
            const uniqueNames = new Set(names);

            expect(uniqueNames.size).toBe(4);
            expect(names).toContain("ItemNotFoundException");
            expect(names).toContain("InvalidItemException");
            expect(names).toContain("InitializationException");
            expect(names).toContain("DBexception");
        });
    });

    describe("Error Handling in Try-Catch", () => {
        it("should catch ItemNotFoundException specifically", () => {
            let caught = false;

            try {
                throw new ItemNotFoundException("Not found");
            } catch (error) {
                caught = error instanceof ItemNotFoundException;
            }

            expect(caught).toBe(true);
        });

        it("should catch InitializationException with cause", () => {
            let caught = false;
            let message = "";

            try {
                throw new InitializationException("Init failed", new Error("Port in use"));
            } catch (error) {
                caught = error instanceof InitializationException;
                message = (error as Error).message;
            }

            expect(caught).toBe(true);
            expect(message).toContain("Port in use");
        });

        it("should catch DBexception with cause", () => {
            let caught = false;
            let message = "";

            try {
                throw new DBexception("Query failed", new Error("Connection lost"));
            } catch (error) {
                caught = error instanceof DBexception;
                message = (error as Error).message;
            }

            expect(caught).toBe(true);
            expect(message).toContain("Connection lost");
        });

        it("should handle mixed exception types", () => {
            const errors: Error[] = [];

            try {
                throw new ItemNotFoundException("Item not found");
            } catch (error) {
                errors.push(error as Error);
            }

            try {
                throw new DBexception("DB error", new Error("Connection failed"));
            } catch (error) {
                errors.push(error as Error);
            }

            expect(errors.length).toBe(2);
            expect(errors[0].name).toBe("ItemNotFoundException");
            expect(errors[1].name).toBe("DBexception");
        });
    });
});
