CREATE TYPE "ManagementCategory" AS ENUM ('CASH', 'INVESTMENT', 'CREDIT_CARD', 'DEBIT_CARD', 'LOAN', 'SAVINGS');

ALTER TABLE "Management" ADD COLUMN "category" "ManagementCategory";
