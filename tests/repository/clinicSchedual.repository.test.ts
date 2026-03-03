jest.mock("uuid", () => ({ v4: () => "fixed-id" }));

const mockQuery = jest.fn();

jest.mock("../../src/utils/dbConnectionManager", () => {
    const Impl = jest.fn().mockImplementation(() => ({
        getPool: () => ({ query: mockQuery }),
        end: jest.fn()
    }));
    return { ConnectionManager: Impl, default: Impl };
});

import { NeonClinicScheduleRepository } from "../../src/repository/neon/clinicSchedual.repository";

describe("NeonClinicScheduleRepository", () => {
    let repo: NeonClinicScheduleRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = new NeonClinicScheduleRepository();
    });

    it("creates a schedule and returns generated id", async () => {
        const resultRow = { id: "fixed-id" };
        mockQuery.mockResolvedValueOnce({ rows: [resultRow] });

        const payload = { weekday: 1, open_time: "08:00", close_time: "17:00", slot_step_minutes: 15, active: "ACTIVE" } as any;
        const id = await repo.create(payload);
        expect(id).toBe("fixed-id");
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO clinic_schedule"), expect.any(Array));
    });

    it("retrieves schedule by id", async () => {
        const row = { id: "fixed-id", weekday: 1, open_time: "08:00", close_time: "17:00", slot_step_minutes: 15, active: "ACTIVE" };
        mockQuery.mockResolvedValueOnce({ rows: [row] });

        const res = await repo.getById("fixed-id");
        expect(res).toEqual(row);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM clinic_schedule WHERE id"), ["fixed-id"]);
    });

    it("retrieves all schedules", async () => {
        const rows = [{ id: "1" }, { id: "2" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getAll();
        expect(res).toEqual(rows);
    });

    it("updates a schedule", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.update("fixed-id", { weekday: 2 } as any)).resolves.toBeUndefined();
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE clinic_schedule"), expect.any(Array));
    });

    it("deletes a schedule", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM clinic_schedule"), ["fixed-id"]);
    });
});
