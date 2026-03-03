jest.mock("uuid", () => ({ v4: () => "fixed-id" }));

const mockQuery = jest.fn();

jest.mock("../../src/utils/dbConnectionManager", () => {
    return jest.fn().mockImplementation(() => ({
        getPool: () => ({ query: mockQuery }),
        end: jest.fn()
    }));
});

import { AppointmentRepository } from "../../src/repository/neon/appointment.repository";

describe("AppointmentRepository", () => {
    let repo: AppointmentRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = new AppointmentRepository();
    });

    it("creates an appointment and returns generated id", async () => {
        mockQuery.mockResolvedValueOnce({}); // BEGIN
        mockQuery.mockResolvedValueOnce({}); // insert
        mockQuery.mockResolvedValueOnce({}); // COMMIT

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
        expect(id).toBe("fixed-id");
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
