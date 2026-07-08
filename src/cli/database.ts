#!/usr/bin/env node
import "dotenv/config";
import { checkDatabase, initializeDatabase } from "../services/databaseSetup.js";

const command = process.argv[2];

try {
  if (command === "init") {
    await initializeDatabase();
    console.log("Database schema initialized.");
  } else if (command === "check") {
    const result = await checkDatabase();
    console.log(`Database ready: ${result.table}`);
  } else {
    console.error("Usage: tsx src/cli/database.ts <init|check>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
