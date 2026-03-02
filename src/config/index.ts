import dotenv from "dotenv";
import path from "path";
import { DbMode } from "./types";
import { StringValue } from "ms";
dotenv.config({ path: path.join(__dirname, "../../.env") });

const dataDir = path.join(__dirname, "../data");

export default {
    PORT: process.env.PORT || 3000,
    logDir: process.env.LOG_DIR || "./logs",
    isDev: process.env.NODE_ENV === "development",
    StoragePath: {
        csv: process.env.CSV_STORAGE_PATH || path.join(dataDir, "cake orders.csv"),
        xml: process.env.XML_STORAGE_PATH || path.join(dataDir, "toy orders.xml"),
        json: process.env.JSON_STORAGE_PATH || path.join(dataDir, "book orders.json"),
        sqlite: process.env.SQLITE_STORAGE_PATH || path.join(dataDir, "orders.db"),
    },
    port : parseInt(process.env.PORT || "3000", 10),
    host : process.env.HOST || 'localhost',
    auth : {
        secretKey: process.env.JWT_SECRET || 'jwt_secret_key_1234567890',
        tokenExpiry: (process.env.JWT_EXPIRY || '15m') as StringValue,
        refreshTokenExpiry: (process.env.JWT_REFRESH_EXPIRY || '7d') as StringValue,
    },
    dbMode: DbMode.POSTGRESQL, // or "database"
};