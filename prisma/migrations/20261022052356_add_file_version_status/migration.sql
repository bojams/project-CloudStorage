-- CreateEnum
CREATE TYPE "FileVersionStatus" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN     "status" "FileVersionStatus" NOT NULL DEFAULT 'READY';
