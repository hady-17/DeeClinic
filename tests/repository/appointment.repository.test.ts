let repo: any;
let mockQuery: jest.Mock;

describe("AppointmentRepository", () => {
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
        const mod = require("../../src/repository/neon/appointment.repository");
        repo = new mod.AppointmentRepository();
    });

    it("creates an appointment and returns generated id", async () => {
        mockQuery.mockImplementation((sql: any) => {
            if (typeof sql === "string" && /INSERT INTO|RETURNING id/i.test(sql)) {
                return Promise.resolve({ rows: [{ id: "fixed-id" }] });
            }
            return Promise.resolve({});
        });

        const payload = {
            client_id: "c1",
            service_id: "s1",
            start_time: new Date(),
            end_time: new Date(Date.now() + 3600000),
            status: "scheduled",
            client_note: null,
            admin_note: null
        } as any;

        const id = await repo.create(payload);
        expect(id).toBeDefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("INSERT INTO appointments"))).toBeTruthy();
    });

    it("retrieves an appointment by id", async () => {
        const row = { id: "fixed-id", client_id: "c1", service_id: "s1", start_time: new Date(), end_time: new Date(), status: "scheduled" };
        mockQuery.mockResolvedValueOnce({ rows: [row] });

        const res = await repo.getById("fixed-id");
        expect(res).toEqual(row);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM appointments WHERE id"), ["fixed-id"]);
    });

    it("returns all appointments", async () => {
        const rows = [{ id: "1" }, { id: "2" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getAll();
        expect(res).toEqual(rows);
    });

    it("updates an appointment", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.update("fixed-id", { status: "cancelled" } as any)).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("UPDATE appointments"))).toBeTruthy();
    });

    it("deletes an appointment", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
        expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("DELETE FROM appointments"))).toBeTruthy();
    });

    it("retrieves appointments by client id", async () => {
        const rows = [{ id: "1", client_id: "c1" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getByClientId("c1");
        expect(res).toEqual(rows);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM appointments WHERE client_id"), ["c1"]);
    });
});
