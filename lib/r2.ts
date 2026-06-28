import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return { client: client!, bucket };
}

export interface PutResult {
  pathname: string;
}

export async function putObject(
  key: string,
  body: PutObjectCommand["input"]["Body"],
  contentType?: string,
): Promise<PutResult> {
  const r2 = getR2Client();
  if (!r2) throw new Error("R2 storage is not configured");

  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { pathname: key };
}

export interface GetResult {
  stream: ReadableStream;
  contentType: string;
  etag: string;
}

type R2Body = {
  transformToWebStream?: () => ReadableStream;
} | ReadableStream | import("stream").Readable;

async function toWebStream(body: R2Body): Promise<ReadableStream> {
  if ("transformToWebStream" in body && typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }

  if (body instanceof ReadableStream) {
    return body;
  }

  const { Readable } = await import("node:stream");
  return Readable.toWeb(body) as ReadableStream;
}

export async function getObject(key: string): Promise<GetResult | null> {
  const r2 = getR2Client();
  if (!r2) throw new Error("R2 storage is not configured");

  try {
    const result = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
    );

    if (!result.Body) return null;

    const stream = await toWebStream(result.Body as R2Body);

    return {
      stream,
      contentType: result.ContentType ?? "application/octet-stream",
      etag: result.ETag ?? "",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") return null;
    throw error;
  }
}

export async function getObjectText(key: string): Promise<string | null> {
  const r2 = getR2Client();
  if (!r2) return null;

  try {
    const result = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
    );

    if (!result.Body) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as unknown as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") return null;
    throw error;
  }
}
