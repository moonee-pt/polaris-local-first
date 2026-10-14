import { MongoClient } from "mongodb";
const uri = "mongodb+srv://ptyycc_db_user:ki1ar1Cv4Z9Nq1xD@forum.uxv48u5.mongodb.net/?appName=Forum";
const c = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const db = c.db("polaris");
for (const name of ["sync_personas","sync_settings","sync_conversations","sync_collection"]) {
  const docs = await db.collection(name).find({}).toArray();
  console.log("=====", name);
  for (const d of docs) {
    const clone = { ...d, data: undefined };
    console.log(JSON.stringify(clone));
    const s = JSON.stringify(d.data);
    console.log("   data:", s.length > 1200 ? s.slice(0,1200)+"..." : s);
  }
}
await c.close();
