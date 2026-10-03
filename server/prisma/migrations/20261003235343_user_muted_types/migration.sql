-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
