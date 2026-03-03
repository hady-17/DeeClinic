let repo: any;
let mockQuery: jest.Mock;

describe("NeonUserRepository", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockQuery = jest.fn();
        jest.doMock("uuid", () => ({ v4: () => "fixed-id" }));
        jest.doMock("../../src/utils/dbConnectionManager", () => {
            const Impl = jest.fn().mockImplementation(() => ({
                getPool: () => ({ query: mockQuery }),
                end: jest.fn()
            }));
            return { ConnectionManager: Impl, default: Impl };
        });
        const mod = require("../../src/repository/neon/user.repository");
        const userMod = require("../../src/models/user.model");
        // ensure User class is available to later expects
        repo = new mod.NeonUserRepository();
    });

    it("creates a user and returns generated id", async () => {
        mockQuery.mockImplementation((sql: any) => {
            if (typeof sql === "string") {
                if (/SELECT 1 FROM users WHERE email/i.test(sql)) return Promise.resolve({ rows: [] });
                if (/INSERT INTO users|RETURNING id/i.test(sql)) return Promise.resolve({ rows: [{ id: "fixed-id" }] });
            }
            return Promise.resolve({});
        });

        const user = {
            getName: () => "Alice",
            getEmail: () => "a@example.com",
            getPasswordHash: () => "hash",
            getRole: () => "RECEPTIONIST",
            getStatus: () => "INACTIVE"
        } as any;
        const id = await repo.create(user);
        expect(id).toBeDefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("INSERT INTO users"))).toBeTruthy();
    });

    it("retrieves user by id", async () => {
        const row = { id: "fixed-id", name: "Alice", email: "a@example.com", password_hash: "hash", role: "RECEPTIONIST", status: "INACTIVE", created_at: new Date() };
        mockQuery.mockResolvedValueOnce({ rows: [row] });

        const res = await repo.getById("fixed-id");
        expect(res).toBeInstanceOf(User);
        expect(res.getEmail()).toBe(row.email);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM users WHERE id"), ["fixed-id"]);
    });

    it("retrieves user by email", async () => {
        const row = { id: "fixed-id", name: "Alice", email: "a@example.com", password_hash: "hash", role: "RECEPTIONIST", status: "INACTIVE", created_at: new Date() };
        mockQuery.mockResolvedValueOnce({ rows: [row] });

        const res = await repo.getbyEmail("a@example.com");
        expect(res).toBeInstanceOf(User);
        expect(res.getId()).toBe(row.id);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM users WHERE email"), ["a@example.com"]);
    });

    it("retrieves all users", async () => {
        const rows = [{ id: "1", name: "A" }, { id: "2", name: "B" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getAll();
        expect(Array.isArray(res)).toBeTruthy();
        expect(res.length).toBe(2);
    });

    it("updates a user", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({ rows: [{ id: "fixed-id" }] }); // update returns rows
        mockQuery.mockResolvedValueOnce({}); // COMMIT

        const user = new User("fixed-id", "Alice", "a@example.com", "hash");
        await expect(repo.update("fixed-id", user as any)).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("UPDATE users"))).toBeTruthy();
    });

    it("deletes a user", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({}); // delete
        mockQuery.mockResolvedValueOnce({}); // COMMIT

        await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("DELETE FROM users"))).toBeTruthy();
    });
});
