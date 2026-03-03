jest.mock("uuid", () => ({ v4: () => "fixed-id" }));

const mockQuery = jest.fn();

jest.mock("../../src/utils/dbConnectionManager", () => {
    const Impl = jest.fn().mockImplementation(() => ({
        getPool: () => ({ query: mockQuery }),
        end: jest.fn()
    }));
    return { ConnectionManager: Impl, default: Impl };
});

import { NeonFeedbackRepository } from "../../src/repository/neon/feedback.repository";
import { FeedbackRating } from "../../src/models/feedback.model";

describe("NeonFeedbackRepository", () => {
    let repo: NeonFeedbackRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = new NeonFeedbackRepository();
    });

    it("creates feedback and returns id", async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: "fixed-id" }] });
        const item = { appointment_id: "a1", rating: FeedbackRating.FIVE, comment: "ok" } as any;
        const id = await repo.create(item);
        expect(id).toBe("fixed-id");
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO feedback"), expect.any(Array));
    });

    it("retrieves feedback by id", async () => {
        const row = { id: "fixed-id", appointment_id: "a1", rating: "5", comment: "ok" };
        mockQuery.mockResolvedValueOnce({ rows: [row] });
        const res = await repo.getById("fixed-id");
        expect(res).toEqual(row);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM feedback WHERE id"), ["fixed-id"]);
    });

    it("retrieves all feedback", async () => {
        const rows = [{ id: "1" }, { id: "2" }];
        mockQuery.mockResolvedValueOnce({ rows });
        const res = await repo.getAll();
        expect(res).toEqual(rows);
    });

    it("updates feedback", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.update("fixed-id", { rating: FeedbackRating.FOUR } as any)).resolves.toBeUndefined();
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE feedback"), expect.any(Array));
    });

    it("deletes feedback", async () => {
        mockQuery.mockResolvedValueOnce({});
        await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM feedback"), ["fixed-id"]);
    });
});
