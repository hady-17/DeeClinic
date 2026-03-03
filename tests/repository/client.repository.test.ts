jest.mock("uuid", () => ({ v4: () => "fixed-id" }));

const mockQuery = jest.fn();

jest.mock("../../src/utils/dbConnectionManager", () => {
    const Impl = jest.fn().mockImplementation(() => ({
        getPool: () => ({ query: mockQuery }),
        end: jest.fn()
    }));
    return { ConnectionManager: Impl, default: Impl };
});

import { NeonClientRepository } from "../../src/repository/neon/client.repository";

describe("NeonClientRepository", () => {
    let repo: NeonClientRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = new NeonClientRepository();
    });

    it("creates a client and returns generated id", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({}); // insert
        mockQuery.mockResolvedValueOnce({}); // COMMIT

        const client = { name: "Bob", phone: "+123" } as any;
        const id = await repo.create(client);
        expect(id).toBe("fixed-id");
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("INSERT INTO clients"))).toBeTruthy();
    });

    it("retrieves a client by id", async () => {
        const row = { id: "fixed-id", name: "Bob", phone: "+123", created_at: new Date() };
        mockQuery.mockResolvedValueOnce({ rows: [row] });

        const res = await repo.getById("fixed-id");
        expect(res).toEqual(row);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM clients WHERE id"), ["fixed-id"]);
    });

    it("retrieves all clients", async () => {
        const rows = [{ id: "1" }, { id: "2" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getAll();
        expect(res).toEqual(rows);
    });

    it("updates a client", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // update
        mockQuery.mockResolvedValueOnce({}); // COMMIT

        await expect(repo.update("fixed-id", { name: "Bobby", phone: "+321" } as any)).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("UPDATE clients"))).toBeTruthy();
    });

    it("deletes a client", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // delete
        mockQuery.mockResolvedValueOnce({}); // COMMIT

        await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("DELETE FROM clients"))).toBeTruthy();
    });
});
