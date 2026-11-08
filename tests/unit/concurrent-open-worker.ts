/**
 * Child process for the concurrent first-open test. It reports "ready", waits for the go
 * file so that every process starts together, then opens the database the way the app does.
 */
import { existsSync } from "node:fs";
import { getDatabase } from "../../src/server/db/client";

const goFile = process.argv[2] ?? "";

process.stdout.write("ready\n");
while (!existsSync(goFile)) {
  await new Promise((resolve) => setTimeout(resolve, 1));
}
getDatabase().close();
