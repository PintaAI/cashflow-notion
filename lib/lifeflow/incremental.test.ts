// @ts-nocheck -- Bun integration tests against an isolated PostgreSQL fixture.
import { afterAll, expect, mock, test as bunTest } from "bun:test";
const isolated = process.env.DATABASE_URL?.includes("127.0.0.1:55439/ethos_sync_test") === true;
const test = isolated ? bunTest : bunTest.skip;
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("@/lib/api/helpers", () => ({ ApiError,
  requireSession: async request => { const id=request.headers.get("x-test-user"); if(!id)throw new ApiError("Unauthorized",401); return {user:{id}}; },
  ok: data => Response.json({data}), handleError: error => Response.json({error:error.message},{status:error.status??500}),
}));
const { prisma } = await import("@/lib/db/client");
const { incrementalLifeFlow, incrementalInput } = await import("./incremental");
const { syncLifeFlow } = await import("./store");
const { itemPayloadSchema } = await import("./contract");
const { syncCapabilities } = await import("@/lib/sync/capabilities");
const users: string[] = [], wallets: string[] = [];
const stamp = "2026-10-02T10:00:00.000Z";
function item(id, name = "Read", updatedAt = stamp) {
  return { kind: "item", id, updatedAt, data: itemPayloadSchema.parse({
    id, kind: "habit", name, color: "#123456", starts_on: "2020-01-01", start_time: null, end_time: null,
    break_durations_json: "[]", recurrence_frequency: "daily", recurrence_interval: 1,
    recurrence_weekdays_json: "[]", recurrence_ends_on: null, system_type: null, created_at: stamp,
  }) };
}
async function fixture() {
  const id = `sync-test-${crypto.randomUUID()}`; users.push(id);
  await prisma.user.create({ data: { id, name: "Sync fixture", email: `${id}@example.invalid` } });
  return id;
}
afterAll(async () => {
  if (!isolated) return;
  await prisma.management.deleteMany({ where: { id: { in: wallets } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test("legacy writes appear in incremental bootstrap and old timestamps still get a new server revision", async () => {
  const user = await fixture();
  await syncLifeFlow(user, [item("first")]);
  const initial = await incrementalLifeFlow(user, { mutations: [] });
  expect(initial.entities.map((entity) => entity.id)).toEqual(["first"]);
  await syncLifeFlow(user, [item("offline", "Offline", "2020-01-01T00:00:00.000Z")]);
  const delta = await incrementalLifeFlow(user, { mutations: [], cursor: initial.nextCursor });
  expect(delta.entities.map((entity) => entity.id)).toEqual(["offline"]);
  expect(BigInt(delta.revisions[0])).toBeGreaterThan(BigInt(initial.revisions[0]));
});

test("a lost response is retried with the same receipt; same-timestamp edits use their base revision", async () => {
  const user = await fixture();
  const first = { mutationId: "create", baseRevision: "0", entity: item("habit") };
  const created = await incrementalLifeFlow(user, { mutations: [first] });
  const repeated = await incrementalLifeFlow(user, { mutations: [first], cursor: created.nextCursor });
  expect(repeated.results).toEqual(created.results);
  expect(repeated.entities).toHaveLength(0);
  const edited = await incrementalLifeFlow(user, { cursor: created.nextCursor, mutations: [{ mutationId: "edit", baseRevision: created.results[0].revision, entity: item("habit", "Second") }] });
  expect(edited.results[0].entity.data.name).toBe("Second");
  expect(BigInt(edited.results[0].revision)).toBeGreaterThan(BigInt(created.results[0].revision));
  await expect(incrementalLifeFlow(user, { mutations: [{ ...first, entity: item("habit", "Identity reused") }] })).rejects.toThrow("identity reused");
});

test("paginated bootstrap uses a fixed watermark while another device writes, then catches the delta", async () => {
  const user = await fixture();
  await syncLifeFlow(user, Array.from({ length: 205 }, (_, index) => item(`habit-${String(index).padStart(3, "0")}`)));
  const first = await incrementalLifeFlow(user, { mutations: [] });
  expect(first.entities).toHaveLength(200); expect(first.hasMore).toBe(true);
  await syncLifeFlow(user, [item("late")]);
  const second = await incrementalLifeFlow(user, { mutations: [], cursor: first.nextCursor });
  expect(second.entities).toHaveLength(5); expect(second.hasMore).toBe(false);
  const delta = await incrementalLifeFlow(user, { mutations: [], cursor: second.nextCursor });
  expect(delta.entities.map((entity) => entity.id)).toEqual(["late"]);
});

test("a cursor for a different account requests bootstrap instead of disclosing that account", async () => {
  const first = await fixture(), second = await fixture();
  const cursor = await incrementalLifeFlow(first, { mutations: [] });
  const reset = await incrementalLifeFlow(second, { mutations: [], cursor: cursor.nextCursor });
  expect(reset.resetRequired).toBe(true); expect(reset.entities).toEqual([]);
});

test("invalid dependent mutations roll back domain changes and receipts together", async () => {
  const user = await fixture();
  const invalid = incrementalInput.parse({ mutations: [{ mutationId: "orphan", baseRevision: "0", entity: { kind: "habit_log", id: "missing|2026-10-02", updatedAt: stamp, data: { item_id: "missing", date: "2026-10-02", completed_at: stamp, updated_at: stamp } } }] });
  await expect(incrementalLifeFlow(user, invalid)).rejects.toThrow("missing item");
  expect(await prisma.lifeFlowSyncReceipt.count({ where: { userId: user } })).toBe(0);
  expect(await prisma.lifeFlowEntity.count({ where: { userId: user } })).toBe(0);
});

test("all metadata writers increment wallet revisions, including delete and moving between wallets", async () => {
  const first = await prisma.management.create({ data: { name: "Sync fixture A" } });
  const second = await prisma.management.create({ data: { name: "Sync fixture B" } });
  wallets.push(first.id, second.id);
  const category = await prisma.category.create({ data: { name: "Food", managementId: first.id } });
  const before = await prisma.walletSyncRevision.findUnique({ where: { managementId: first.id } });
  await prisma.category.update({ where: { id: category.id }, data: { managementId: second.id } });
  expect((await prisma.walletSyncRevision.findUnique({ where: { managementId: first.id } })).categories).toBeGreaterThan(before.categories);
  expect((await prisma.walletSyncRevision.findUnique({ where: { managementId: second.id } })).categories).toBe(BigInt(1));
  await prisma.category.delete({ where: { id: category.id } });
  expect((await prisma.walletSyncRevision.findUnique({ where: { managementId: second.id } })).categories).toBe(BigInt(2));
  expect(await syncCapabilities()).toEqual({ lifeFlow: 2, metadata: 1 });
});

test("revision watermark cannot pass an earlier uncommitted change", async () => {
  const user=await fixture(); await syncLifeFlow(user,[item("first"),item("second")]);
  const initial=await incrementalLifeFlow(user,{mutations:[]});
  let entered,release;
  const ready=new Promise(resolve=>entered=resolve), gate=new Promise(resolve=>release=resolve);
  const slow=prisma.$transaction(async tx=>{
    await tx.lifeFlowEntity.update({where:{userId_kind_entityId:{userId:user,kind:"item",entityId:"first"}},data:{payload:item("first","Slow").data}});
    entered(); await gate;
  },{timeout:10000});
  await ready;
  let committed=false;
  const later=prisma.$transaction(async tx=>{
    await tx.lifeFlowEntity.update({where:{userId_kind_entityId:{userId:user,kind:"item",entityId:"second"}},data:{payload:item("second","Later").data}});
  },{timeout:10000}).then(()=>{committed=true;});
  await new Promise(resolve=>setTimeout(resolve,30)); expect(committed).toBe(false);
  release(); await Promise.all([slow,later]);
  const delta=await incrementalLifeFlow(user,{mutations:[],cursor:initial.nextCursor});
  expect(delta.entities.map(entity=>entity.id)).toEqual(["first","second"]);
  expect(BigInt(delta.revisions[1])).toBeGreaterThan(BigInt(delta.revisions[0]));
});

test("numeric legacy notification flags are accepted narrowly and feature switch preserves v1",async()=>{
  const payload=item("flags").data;
  expect(itemPayloadSchema.parse({...payload,notify_start:0,notify_end:1})).toMatchObject({notify_start:false,notify_end:true});
  expect(itemPayloadSchema.parse({...payload,notify_start:undefined,notify_end:undefined})).toMatchObject({notify_start:true,notify_end:true});
  for(const invalid of [2,"false",null]) expect(itemPayloadSchema.safeParse({...payload,notify_start:invalid}).success).toBe(false);
  process.env.ETHOS_SYNC_V2_ENABLED="false";
  try {expect(await syncCapabilities()).toEqual({lifeFlow:1,metadata:0});} finally {delete process.env.ETHOS_SYNC_V2_ENABLED;}
});


test("new routes require a session and wallet manifests enforce membership",async()=>{
 const {GET:manifest}=await import("@/app/api/v1/sync/manifest/route");
 const {GET:capabilities}=await import("@/app/api/v1/sync/capabilities/route");
 const {POST:page}=await import("@/app/api/v1/lifeflow/sync-v2/route");
 const user=await fixture(),outsider=await fixture();
 const wallet=await prisma.management.create({data:{name:"Scoped fixture"}});wallets.push(wallet.id);
 await prisma.managementMember.create({data:{managementId:wallet.id,userId:user}});
 expect((await capabilities(new Request("http://test/sync/capabilities"))).status).toBe(401);
 expect((await page(new Request("http://test/lifeflow/sync-v2",{method:"POST",body:"{}"}))).status).toBe(401);
 const request=id=>new Request(`http://test/sync/manifest?management_id=${wallet.id}`,{headers:{"x-test-user":id}});
 expect((await manifest(request(outsider))).status).toBe(403);
 expect((await manifest(request(user))).status).toBe(200);
 const response=await capabilities(new Request("http://test/sync/capabilities",{headers:{"x-test-user":user}}));
 expect((await response.json()).data.accountId).toBe(user);
});

test("quick fill, budget and recurring direct writers invalidate their respective manifest areas",async()=>{
 const wallet=await prisma.management.create({data:{name:"Writer fixture"}});wallets.push(wallet.id);
 const quick=await prisma.quickFill.create({data:{name:"Coffee",nominal:10,managementId:wallet.id}});
 const budget=await prisma.overallBudget.create({data:{managementId:wallet.id,period:"monthly",amount:100}});
 const recurring=await prisma.recurringEntry.create({data:{managementId:wallet.id,name:"Rent",nominal:20,io:"Expenses",frequency:"monthly",startDate:"2026-10-01"}});
 const first=await prisma.walletSyncRevision.findUnique({where:{managementId:wallet.id}});
 await prisma.quickFill.update({where:{id:quick.id},data:{nominal:11}});
 await prisma.overallBudget.delete({where:{id:budget.id}});
 await prisma.recurringEntry.update({where:{id:recurring.id},data:{name:"Updated rent"}});
 const second=await prisma.walletSyncRevision.findUnique({where:{managementId:wallet.id}});
 for(const area of ["quickFills","budgets","recurring"])expect(second[area]).toBeGreaterThan(first[area]);
});
