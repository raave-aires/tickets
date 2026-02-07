-- AlterTable
ALTER TABLE "ticket_message" ADD COLUMN     "attachmentFileNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
