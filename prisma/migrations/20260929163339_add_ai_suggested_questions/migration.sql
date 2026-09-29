-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "aiSuggestedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
