import type { SqliteDatabase } from "./connection.js";

export type SqliteTransaction = Parameters<Parameters<SqliteDatabase["transaction"]>[0]>[0];
export type SqliteTransactionState = SqliteDatabase | SqliteTransaction;
