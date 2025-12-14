/*
  Warnings:

  - You are about to drop the column `run_scripts` on the `Project` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "default_model" TEXT NOT NULL DEFAULT 'auto',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("created_at", "default_model", "id", "name", "path", "updated_at") SELECT "created_at", "default_model", "id", "name", "path", "updated_at" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_path_key" ON "Project"("path");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
