import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { putVideo, readS3Config } from "@/lib/aws-s3";

// Sube un MP4 local al bucket con la clave que la aplicación espera:
// event-videos/<id del evento>.mp4. Uso:
//   npx tsx scripts/upload-video-s3.ts <archivo.mp4> <eventId>
const [, , filePath, eventId] = process.argv;
if (!filePath || !eventId) {
  console.error("Uso: tsx scripts/upload-video-s3.ts <archivo.mp4> <eventId>");
  process.exit(1);
}
const s3 = readS3Config();
if (!s3) {
  console.error("Faltan AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY o AWS_S3_BUCKET.");
  process.exit(1);
}
const size = statSync(filePath).size;
const result = await putVideo(
  s3,
  `event-videos/${eventId}.mp4`,
  Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>,
  size,
);
console.log(result.ok ? `SUBIDO_A_S3 ${size} bytes` : `ERROR: ${result.error}`);
