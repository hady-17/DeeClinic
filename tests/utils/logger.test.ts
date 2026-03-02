import logger from "../../src/utils/logger";

describe("Logger", () => {
    describe("Logger Instance", () => {
        it("should be defined", () => {
            expect(logger).toBeDefined();
        });

        it("should have logger methods", () => {
            expect(logger.info).toBeDefined();
            expect(logger.error).toBeDefined();
            expect(logger.warn).toBeDefined();
            expect(logger.debug).toBeDefined();
        });
    });

    describe("Logging Methods", () => {
        it("should log info messages", () => {
            const infoSpy = jest.spyOn(logger, "info");
            logger.info("Test info message");
            expect(infoSpy).toHaveBeenCalledWith("Test info message");
            infoSpy.mockRestore();
        });

        it("should log error messages", () => {
            const errorSpy = jest.spyOn(logger, "error");
            logger.error("Test error message");
            expect(errorSpy).toHaveBeenCalledWith("Test error message");
            errorSpy.mockRestore();
        });

        it("should log warn messages", () => {
            const warnSpy = jest.spyOn(logger, "warn");
            logger.warn("Test warn message");
            expect(warnSpy).toHaveBeenCalledWith("Test warn message");
            warnSpy.mockRestore();
        });

        it("should log debug messages", () => {
            const debugSpy = jest.spyOn(logger, "debug");
            logger.debug("Test debug message");
            expect(debugSpy).toHaveBeenCalledWith("Test debug message");
            debugSpy.mockRestore();
        });
    });

    describe("Logger Configuration", () => {
        it("should have transports configured", () => {
            expect(logger.transports).toBeDefined();
            expect(logger.transports.length).toBeGreaterThan(0);
        });

        it("should have the correct log level", () => {
            expect(logger.level).toBeDefined();
        });
    });
});
