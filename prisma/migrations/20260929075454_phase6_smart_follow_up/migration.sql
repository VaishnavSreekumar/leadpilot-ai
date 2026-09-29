-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "followUpFocusPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "followUpGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "followUpMessage" TEXT,
ADD COLUMN     "followUpReason" TEXT,
ADD COLUMN     "followUpRecommendedAt" TIMESTAMP(3);
