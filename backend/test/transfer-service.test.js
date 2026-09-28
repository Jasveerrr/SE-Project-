import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { DeviceService } from "../src/services/DeviceService.js";
import { TransferService } from "../src/services/TransferService.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const prismaCli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url)
);
process.env.DATABASE_URL = `file:${rootDir}/.tmp/swiftshare-test.db`;
process.env.JWT_SECRET = "test-secret";

async function resetDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.transferHistory.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.pairing.deleteMany();
    await prisma.device.deleteMany();
    await prisma.user.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

async function seedUserAndDevices(userId = "user-1") {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: "hash",
        displayName: "Demo User",
      },
    });

    const sender = await prisma.device.create({
      data: {
        deviceId: "device-sender",
        userId: user.id,
        deviceName: "Sender Device",
        ipAddress: "10.0.0.2",
        platform: "WEB",
        status: "connected",
      },
    });

    const receiver = await prisma.device.create({
      data: {
        deviceId: "device-receiver",
        userId: user.id,
        deviceName: "Receiver Device",
        ipAddress: "10.0.0.3",
        platform: "WEB",
        status: "connected",
      },
    });

    return { user, sender, receiver };
  } finally {
    await prisma.$disconnect();
  }
}

test.before(async () => {
  const result = spawnSync(
    process.execPath,
    [prismaCli, "db", "push", "--schema", "prisma/schema.prisma", "--accept-data-loss"],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    }
  );

  if (result.status !== 0) {
    throw new Error(`Prisma db push failed with exit code ${result.status ?? "unknown"}.`);
  }

  await resetDatabase();
});

test.afterEach(async () => {
  await resetDatabase();
});

test("discoverDevices updates same browser device without creating duplicates", async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.user.create({
      data: {
        id: "user-1",
        email: "user-1@example.com",
        passwordHash: "hash",
        displayName: "Demo User",
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const payload = {
    userId: "user-1",
    deviceId: "browser-device",
    deviceName: "Chrome on laptop",
    ipAddress: "127.0.0.1",
    platform: "WEB",
  };

  const first = await DeviceService.discoverDevices({ payload });
  const second = await DeviceService.discoverDevices({
    payload: { ...payload, deviceName: "Chrome on laptop updated" },
  });

  const nextPrisma = new PrismaClient();
  try {
    const rows = await nextPrisma.device.findMany({ where: { userId: "user-1" } });
    assert.equal(rows.length, 1);
    assert.equal(first.device.deviceId, "browser-device");
    assert.equal(second.device.deviceName, "Chrome on laptop updated");
  } finally {
    await nextPrisma.$disconnect();
  }
});

test("completeTransfer rejects when bytesTransferred is still below fileSize", async () => {
  const { sender, receiver } = await seedUserAndDevices("user-1");
  const prisma = new PrismaClient();
  try {
    const transfer = await prisma.transfer.create({
      data: {
        transferId: "transfer-1",
        senderDeviceId: sender.id,
        receiverDeviceId: receiver.id,
        fileName: "demo.txt",
        fileSize: 100n,
        bytesTransferred: 45n,
        progress: 45,
        status: "ACTIVE",
      },
    });

    await assert.rejects(
      () =>
        TransferService.completeTransfer({
          payload: {
            transferId: transfer.transferId,
            userId: sender.userId,
          },
        }),
      /all bytes have been received and confirmed/i
    );
  } finally {
    await prisma.$disconnect();
  }
});
