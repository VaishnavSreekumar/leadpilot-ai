-- AlterTable
ALTER TABLE "AiExecutionLog" ADD COLUMN "retryOfCorrelationId" TEXT;

-- CreateIndex
CREATE INDEX "AiExecutionLog_retryOfCorrelationId_idx" ON "AiExecutionLog"("retryOfCorrelationId");

