-- CreateTable
CREATE TABLE "asset" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);
