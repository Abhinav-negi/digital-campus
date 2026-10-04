/*
  Warnings:

  - You are about to drop the `DocumentImport` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentImport" DROP CONSTRAINT "DocumentImport_authorId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentImport" DROP CONSTRAINT "DocumentImport_classId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentImport" DROP CONSTRAINT "DocumentImport_termId_fkey";

-- DropTable
DROP TABLE "DocumentImport";

-- DropEnum
DROP TYPE "ImportKind";

-- DropEnum
DROP TYPE "ImportStatus";
