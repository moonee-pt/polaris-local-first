import { MongoClient } from "mongodb";
const uri = "mongodb+srv://ptyycc_db_user:ki1ar1Cv4Z9Nq1xD@forum.uxv48u5.mongodb.net/?appName=Forum";
const c = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const db = c.db("polaris");
try { console.log("sync_snapshots count:", await db.collection("sync_snapshots").countDocuments()); } catch(e){ console.log("sync_snapshots err", e.message); }
const snaps = await db.collection("snapshots").find({}).toArray();
for (const s of snaps) {
  const size = JSON.stringify(s).length;
  const keys = Object.keys(s);
  console.log("---", s._id.toString(), s.updatedAt, "bytes", size, "keys", keys.join(","));
  const payload = s.payload ?? s.data ?? s.snapshot;
  if (payload) {
    const p = typeof payload === "string" ? JSON.parse(payload) : payload;
    console.log("   payload keys:", Object.keys(p).join(","));
    console.log("   personas:", (p.personaState?.personas ?? []).map(x=>x.name||x.id).join(","));
    console.log("   conversations:", (p.chatState?.conversations ?? []).length, (p.chatState?.conversations ?? []).map(x=>x.title).join(" | "));
    console.log("   cards:", (p.collectionState?.cards ?? []).length, "images:", (p.collectionState?.imageCards ?? []).length, "projects:", (p.collectionState?.roomProjects ?? []).length);
  }
}
await c.close();
