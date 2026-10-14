import { MongoClient } from "mongodb";
const uri = "mongodb+srv://ptyycc_db_user:ki1ar1Cv4Z9Nq1xD@forum.uxv48u5.mongodb.net/?appName=Forum";
const c = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const db = c.db("polaris");
const cols = await db.listCollections().toArray();
console.log("collections:", cols.map(x=>x.name).join(", "));
for (const name of cols.map(x=>x.name)) {
  const col = db.collection(name);
  const n = await col.countDocuments();
  console.log(`--- ${name}: ${n} docs`);
  const docs = await col.find({}).project({ userId:1, updatedAt:1, createdAt:1, "data.name":1, "data.id":1 }).limit(200).toArray();
  for (const d of docs) console.log("   ", d._id, "|", d.userId, "|", d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt, "|", JSON.stringify(d.data?.name ?? d.data?.id ?? null));
}
await c.close();
