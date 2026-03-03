import { InitializationException } from "../../src/utils/exceptions/repositoryException";

jest.mock("pg", () => {
    const mPool = jest.fn().mockImplementation((opts) => ({ end: jest.fn(), _opts: opts }));
    return { Pool: mPool };
});

describe("ConnectionManager", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it("throws when no connection string is set", () => {
        delete process.env.NEON_DATABASE_URL;
        delete process.env.DATABASE_URL;
        const { default: ConnectionManager } = require("../../src/utils/dbConnectionManager");
        const mgr = new ConnectionManager();
        expect(() => mgr.getPool()).toThrow(/NEON connection manager initialization failed/);
    });

    it("throws when host is a placeholder like 'base'", () => {
        process.env.NEON_DATABASE_URL = "postgresql://user:pass@base:5432/db";
        const { default: ConnectionManager } = require("../../src/utils/dbConnectionManager");
        const mgr = new ConnectionManager();
        expect(() => mgr.getPool()).toThrow(/Invalid NEON host 'base'/);
    });

    it("creates a Pool with ssl option and reuses it, end() closes it", async () => {
        const connStr = "postgresql://user:pass@localhost:5432/db";
        process.env.NEON_DATABASE_URL = connStr;
        const { default: ConnectionManager } = require("../../src/utils/dbConnectionManager");
        const { Pool } = require("pg");
        const mgr = new ConnectionManager();

        const pool1 = mgr.getPool();
        expect(pool1).toBeDefined();
        expect(Pool).toHaveBeenCalledWith({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

        const pool2 = mgr.getPool();
        expect(pool2).toBe(pool1);

        await mgr.end();
        expect(pool1.end).toHaveBeenCalled();

        // subsequent getPool should create a new Pool instance
        const pool3 = mgr.getPool();
        expect(Pool).toHaveBeenCalledTimes(2);
        expect(pool3).not.toBe(pool1);
    });
});
