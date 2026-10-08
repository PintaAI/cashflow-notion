// @ts-nocheck -- Bun-only integration fixture, not application runtime.
// Local fixture only: never load deployment credentials.
import { mock } from "bun:test";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55439/ethos_sync_test")) throw new Error("Isolated sync database required");
class ApiError extends Error { constructor(message, public status) {super(message);} }
mock.module("@/lib/api/helpers",()=>({ApiError}));
const {prisma}=await import("@/lib/db/client");
const {incrementalLifeFlow,incrementalInput}=await import("@/lib/lifeflow/incremental");
const {syncLifeFlow}=await import("@/lib/lifeflow/store");
const id=`e2e-${crypto.randomUUID()}`;
await prisma.user.create({data:{id,name:"Sync E2E",email:`${id}@example.invalid`}});
const server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request){
 try {
  const path=new URL(request.url).pathname;
  if(path==="/lifeflow/sync-v2") return Response.json(await incrementalLifeFlow(id,incrementalInput.parse(await request.json())));
  if(path==="/legacy") return Response.json(await syncLifeFlow(id,(await request.json()).entities));
  if(path==="/dump") return Response.json(await prisma.lifeFlowEntity.findMany({where:{userId:id}}));
  if(path==="/cleanup"){await prisma.user.delete({where:{id}});return Response.json({ok:true});}
  return new Response("Unknown fixture path",{status:404});
 }catch(error){return Response.json({error:error.message},{status:error.status??500});}
}});
await Bun.write("/tmp/ethos-sync-e2e-url.json",JSON.stringify({url:`http://127.0.0.1:${server.port}`}));
console.log("Sync E2E fixture ready");
async function stop(){try{await prisma.user.deleteMany({where:{id}});await prisma.$disconnect();}finally{server.stop(true);process.exit(0);}}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
