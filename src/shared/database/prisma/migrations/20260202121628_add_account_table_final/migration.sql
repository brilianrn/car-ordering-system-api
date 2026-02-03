-- CreateTable
CREATE TABLE "account" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_email_key" ON "account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "account_employee_id_key" ON "account"("employee_id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;
