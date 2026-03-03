let repo: any;
let mockQuery: jest.Mock;

describe("WhatsAppMessageRepository", () => {
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
		const mod = require("../../src/repository/neon/whatsappMessage.repositoy");
		repo = new mod.WhatsAppMessageRepository();
	});

	it("creates a whatsapp message and returns generated id", async () => {
		mockQuery.mockImplementation((sql: any) => {
			if (typeof sql === "string" && /INSERT INTO|RETURNING id/i.test(sql)) {
				return Promise.resolve({ rows: [{ id: "fixed-id" }] });
			}
			return Promise.resolve({});
		});

		const now = new Date();
		const payload = {
			appointment_id: "a1",
			type: "text",
			to_phone: "+123",
			payload_json: "{}",
			status: "pending",
			scheduled_for: now,
			sent_at: null
		} as any;

		const id = await repo.create(payload);
		expect(id).toBeDefined();
		expect(mockQuery).toHaveBeenCalled();
		expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("INSERT INTO whatsapp_messages"))).toBeTruthy();
	});

	it("retrieves a whatsapp message by id", async () => {
		const row = { id: "fixed-id", appointment_id: "a1", type: "text", to_phone: "+123", payload_json: "{}", status: "pending", scheduled_for: new Date(), sent_at: null };
		mockQuery.mockResolvedValueOnce({ rows: [row] });

		const result = await repo.getById("fixed-id");
		expect(result).toEqual(row);
		expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM whatsapp_messages WHERE id"), ["fixed-id"]);
	});

	it("returns empty array for getAll when no rows", async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const res = await repo.getAll();
		expect(res).toEqual([]);
	});

	it("retrieves all whatsapp messages", async () => {
		const rows = [{ id: "1" }, { id: "2" }];
		mockQuery.mockResolvedValueOnce({ rows });
		const res = await repo.getAll();
		expect(res).toEqual(rows);
	});

	it("updates a whatsapp message", async () => {
		mockQuery.mockResolvedValueOnce({}); // BEGIN
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // update
		mockQuery.mockResolvedValueOnce({}); // COMMIT

		await expect(repo.update("fixed-id", { appointment_id: "a1" } as any)).resolves.toBeUndefined();
		expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("UPDATE whatsapp_messages"))).toBeTruthy();
	});

	it("deletes a whatsapp message", async () => {
		mockQuery.mockResolvedValueOnce({}); // BEGIN
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // delete
		mockQuery.mockResolvedValueOnce({}); // COMMIT

		await expect(repo.delete("fixed-id")).resolves.toBeUndefined();
		expect(mockQuery.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("DELETE FROM whatsapp_messages"))).toBeTruthy();
	});

	it("retrieves messages by appointment id", async () => {
		const rows = [{ id: "1", appointment_id: "a1" }];
		mockQuery.mockResolvedValueOnce({ rows });
		const res = await repo.getByAppointmentId("a1");
		expect(res).toEqual(rows);
		expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM whatsapp_messages WHERE appointment_id"), ["a1"]);
	});

	it("retrieves messages by to_phone", async () => {
		const rows = [{ id: "1", to_phone: "+123" }];
		mockQuery.mockResolvedValueOnce({ rows });
		const res = await repo.getByToPhone("+123");
		expect(res).toEqual(rows);
		expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM whatsapp_messages WHERE to_phone"), ["+123"]);
	});
});

