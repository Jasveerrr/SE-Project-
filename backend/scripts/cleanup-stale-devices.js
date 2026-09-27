import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

try {
  const staleDevices = await prisma.device.findMany({
    where: { status: "disconnected" },
    include: { user: { select: { email: true, displayName: true } } },
    orderBy: { lastSeenAt: "desc" },
  });

  console.log(`Found ${staleDevices.length} disconnected device record(s).`);
  for (const device of staleDevices) {
    console.log(
      `${device.deviceId} | ${device.user.displayName || device.user.email} | ${device.deviceName} | last seen ${device.lastSeenAt?.toISOString() || "unknown"}`
    );
  }

  if (!apply || staleDevices.length === 0) {
    console.log(
      apply
        ? "No stale devices to clean."
        : "Dry run only. Re-run with --apply to mark them removed."
    );
  } else {
    const result = await prisma.device.updateMany({
      where: { status: "disconnected" },
      data: { status: "removed", socketId: null, lastSeenAt: new Date() },
    });
    console.log(`Marked ${result.count} disconnected device record(s) as removed.`);
  }
} finally {
  await prisma.$disconnect();
}
