import { get } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

async function downloadFromVercel(pathname: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = process.env.VERCEL_BLOB_TOKEN;
  if (!token) {
    console.error("  ✗ VERCEL_BLOB_TOKEN env var not set");
    return null;
  }

  try {
    const result = await get(pathname, { token, access: "private" });
    if (!result?.stream) return null;

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const contentType = result.blob?.contentType ?? "application/octet-stream";
    console.log(`  ✓ Downloaded (${(buffer.length / 1024).toFixed(1)} KB, ${contentType})`);
    return { buffer, contentType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ Download failed: ${msg}`);
    return null;
  }
}

async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<boolean> {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error("  ✗ R2 env vars not set (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)");
    return false;
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    console.log(`  ✓ Uploaded to r2://${bucket}/${key}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ Upload failed: ${msg}`);
    return false;
  }
}

async function main() {
  console.log("=== Migrating existing images from Vercel Blob to Cloudflare R2 ===\n");

  const users = await prisma.user.findMany({
    where: { image: { startsWith: "profiles/" } },
    select: { id: true, image: true },
  });

  const managements = await prisma.management.findMany({
    where: { image: { startsWith: "managements/" } },
    select: { id: true, image: true },
  });

  const total = users.length + managements.length;

  if (total === 0) {
    console.log("No existing images to migrate. Database is clean.");
    return;
  }

  console.log(`Found ${users.length} profile photos and ${managements.length} management photos to migrate.\n`);

  let migrated = 0;
  let failed = 0;

  for (const user of users) {
    console.log(`[User ${user.id.slice(0, 8)}…] ${user.image}`);
    const downloaded = await downloadFromVercel(user.image!);
    if (downloaded) {
      const ok = await uploadToR2(user.image!, downloaded.buffer, downloaded.contentType);
      if (ok) migrated++;
      else failed++;
    } else {
      failed++;
    }
    console.log();
  }

  for (const mgmt of managements) {
    console.log(`[Management ${mgmt.id.slice(0, 8)}…] ${mgmt.image}`);
    const downloaded = await downloadFromVercel(mgmt.image!);
    if (downloaded) {
      const ok = await uploadToR2(mgmt.image!, downloaded.buffer, downloaded.contentType);
      if (ok) migrated++;
      else failed++;
    } else {
      failed++;
    }
    console.log();
  }

  console.log("=== Migration complete ===");
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Total:    ${total}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
