ALTER TABLE "User"
ADD COLUMN "assignedAdminId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_assignedAdminId_fkey"
FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_assignedAdminId_idx" ON "User"("assignedAdminId");

ALTER TABLE "Booking"
ADD COLUMN "adminId" TEXT,
ADD COLUMN "slot" TEXT,
ADD COLUMN "type" TEXT;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Booking_userId_status_createdAt_idx"
ON "Booking"("userId", "status", "createdAt");

CREATE INDEX "Booking_adminId_status_createdAt_idx"
ON "Booking"("adminId", "status", "createdAt");

CREATE TABLE "BookingMessage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingMessage"
ADD CONSTRAINT "BookingMessage_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BookingMessage_bookingId_createdAt_idx"
ON "BookingMessage"("bookingId", "createdAt");

ALTER TABLE "College"
ADD COLUMN "cutoff" TEXT;
