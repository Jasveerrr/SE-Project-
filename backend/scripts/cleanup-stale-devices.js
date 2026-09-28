import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function reconcileDuplicateDevices() {
  const duplicates = await prisma.device.groupBy({
    by: ["deviceId"],
    _count: { deviceId: true },
    having: { deviceId: { _count: { gt: 1 } } },
  });

  const duplicateDeviceIds = duplicates.map((row) => row.deviceId);
  const duplicateRows = duplicateDeviceIds.length
    ? await prisma.device.findMany({
        where: { deviceId: { in: duplicateDeviceIds } },
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: [{ status: "desc" }, { lastSeenAt: "desc" }, { updatedAt: "desc" }],
      })
    : [];

  const groups = new Map();
  for (const device of duplicateRows) {
    const bucket = groups.get(device.deviceId) ?? [];
    bucket.push(device);
    groups.set(device.deviceId, bucket);
  }

  let matches = 0;
  for (const [deviceId, rows] of groups.entries()) {
    matches += rows.length;
    const canonical = rows[0];
    const staleRows = rows.slice(1);

    console.log(
      `Duplicate deviceId ${deviceId}: keeping ${canonical.deviceName} (${canonical.user?.displayName || canonical.user?.email || canonical.userId}) and marking ${staleRows.length} stale row(s) removed.`
    );

    if (apply) {
      for (const staleDevice of staleRows) {
        await prisma.device.update({
          where: { id: staleDevice.id },
          data: { status: "removed", socketId: null, lastSeenAt: new Date() },
        });
      }
    }
  }

  if (duplicateDeviceIds.length === 0) {
    console.log(
      "No duplicate deviceId records found. Dry run only; run with --apply to reconcile duplicates."
    );
    return;
  }

  if (!apply) {
    console.log(
      `Dry run complete. Found ${matches} duplicate device row(s) across ${duplicateDeviceIds.length} deviceId value(s). Re-run with --apply to mark old duplicates as removed.`
    );
    return;
  }

  console.log(
    `Applied duplicate reconciliation for ${duplicateDeviceIds.length} deviceId value(s).`
  );
}

try {
  await reconcileDuplicateDevices();
} finally {
  await prisma.$disconnect();
}
