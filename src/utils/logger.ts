//skip this file in eslint

import winston from "winston";
import config from "../config";

const logsDir = config.logDir;
const isDev = config.isDev;

const logfileFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json(),
    winston.format.splat(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        ({ timestamp, level, message, stack }) =>
            `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
    )
);
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.splat(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        ({ timestamp, level, message, stack }) =>
            `${timestamp} [${level}]: ${stack || message}`
    )
);
const logger = winston.createLogger({
    level: isDev ? "debug" : "info",
    transports: [
        new winston.transports.File({dirname: logsDir, filename: "error.log", level: "error",format: logfileFormat }),
        new winston.transports.File({ dirname: logsDir, filename: "combined.log", format: logfileFormat }),
    ],
    exceptionHandlers: [
        new winston.transports.File({ dirname: logsDir, filename: "exceptions.log", format: logfileFormat }),
    ],
});
if (isDev) {
    logger.add(new winston.transports.Console({ format: consoleFormat }));
}

export default logger;