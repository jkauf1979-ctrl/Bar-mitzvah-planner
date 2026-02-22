import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const EVENTS = [
  { id: "friday",  name: "Friday Night Dinner", date: "Nov 5, 2027",  icon: "🕯️", shortName: "Friday" },
  { id: "service", name: "Saturday Service",     date: "Nov 6, 2027",  icon: "✡️", shortName: "Service" },
  { id: "party",   name: "Saturday Party",       date: "Nov 6, 2027",  icon: "🎉", shortName: "Party" },
  { id: "brunch",  name: "Sunday Brunch",        date: "Nov 7, 2027",  icon: "🥂", shortName: "Brunch" },
];
const MEAL_OPTIONS = ["Chicken", "Fish", "Vegetarian", "Kids Meal"];
const BAR_MITZVAH_DATE = new Date("2027-11-06");
const ACCOMMODATION_OPTIONS = ["Not needed (local)", "Hotel – arranged", "Hotel – self arranged", "Staying with family", "Other"];
const EXPENSE_CATEGORIES = ["Venue", "Catering", "Music / DJ", "Photography", "Flowers / Decor", "Invitations", "Clothing", "Rabbi / Cantor", "Transportation", "Hotel / Accommodation", "Other"];
const TABS = ["Dashboard", "Families & Guests", "Seating", "Costs", "Vendors", "Gifts", "Run of Show", "Bar Mitzvah", "Timeline"];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const F = "'Cormorant Garamond', Georgia, serif";
const FB = "'DM Sans', system-ui, sans-serif";
const NAVY = "#1a2744";
const GOLD = "#c9a84c";
const LIGHT_GOLD = "#f5eed9";
const BORDER = "#e8e4dc";

const iS = (x={}) => ({ padding:"9px 12px", borderRadius:8, border:`1px solid ${BORDER}`, fontSize:13, outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:FB, color:NAVY, ...x });
const lS = { fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"#9ca3af", marginBottom:5, fontFamily:FB };
const card = (x={}) => ({ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:16, padding:"20px 22px", boxShadow:"0 2px 12px rgba(26,39,68,.06)", ...x });
const btn = (variant="primary", x={}) => ({
  border:"none", borderRadius:9, padding:"9px 20px", cursor:"pointer", fontFamily:FB, fontWeight:600, fontSize:13,
  ...(variant==="primary" ? { background:NAVY, color:"#fff" } : {}),
  ...(variant==="ghost"   ? { background:"#fff", color:NAVY, border:`1px solid ${BORDER}` } : {}),
  ...(variant==="danger"  ? { background:"#fff", color:"#dc2626", border:"1px solid #fecaca" } : {}),
  ...(variant==="gold"    ? { background:GOLD, color:"#fff" } : {}),
  ...x
});
const RSVP_STYLE = {
  yes:    { bg:"#f0fdf4", color:"#16a34a", border:"#bbf7d0" },
  no:     { bg:"#fef2f2", color:"#dc2626", border:"#fecaca" },
  maybe:  { bg:"#fffbeb", color:"#d97706", border:"#fde68a" },
  "":     { bg:"#f9fafb", color:"#9ca3af", border:BORDER },
};

// ─────────────────────────────────────────────────────────────────────────────
// AIRTABLE API
// ─────────────────────────────────────────────────────────────────────────────
class AT {
  constructor(token, baseId) { this.t=token; this.b=baseId; }
  h() { return { "Authorization":`Bearer ${this.t}`, "Content-Type":"application/json" }; }
  async listBases() { const r=await fetch("https://api.airtable.com/v0/meta/bases",{headers:this.h()}); if(!r.ok)throw new Error("Invalid token"); return r.json(); }
  async createBase(name,wsId) { const r=await fetch("https://api.airtable.com/v0/meta/bases",{method:"POST",headers:this.h(),body:JSON.stringify({name,workspaceId:wsId,tables:[{name:"Config",fields:[{name:"Key",type:"singleLineText"}]}]})}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||"Create base failed");} return r.json(); }
  async getTables() { const r=await fetch(`https://api.airtable.com/v0/meta/bases/${this.b}/tables`,{headers:this.h()}); if(!r.ok)throw new Error("Schema read failed"); return r.json(); }
  async createTable(name,fields) { await new Promise(r=>setTimeout(r,250)); const r=await fetch(`https://api.airtable.com/v0/meta/bases/${this.b}/tables`,{method:"POST",headers:this.h(),body:JSON.stringify({name,fields})}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`Table ${name} failed`);} return r.json(); }
  async all(table,formula="") { let records=[],offset=""; do { let url=`https://api.airtable.com/v0/${this.b}/${encodeURIComponent(table)}?pageSize=100`; if(formula)url+=`&filterByFormula=${encodeURIComponent(formula)}`; if(offset)url+=`&offset=${offset}`; const r=await fetch(url,{headers:this.h()}); if(!r.ok)throw new Error(`Fetch ${table} failed`); const d=await r.json(); records=[...records,...(d.records||[])]; offset=d.offset||""; } while(offset); return records; }
  async create(table,fields) { const r=await fetch(`https://api.airtable.com/v0/${this.b}/${encodeURIComponent(table)}`,{method:"POST",headers:this.h(),body:JSON.stringify({fields})}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||"Create failed");} return r.json(); }
  async update(table,id,fields) { const r=await fetch(`https://api.airtable.com/v0/${this.b}/${encodeURIComponent(table)}/${id}`,{method:"PATCH",headers:this.h(),body:JSON.stringify({fields})}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||"Update failed");} return r.json(); }
  async del(table,id) { const r=await fetch(`https://api.airtable.com/v0/${this.b}/${encodeURIComponent(table)}/${id}`,{method:"DELETE",headers:this.h()}); if(!r.ok)throw new Error("Delete failed"); }
  async getConfig(key) { const recs=await this.all("Config",`{Key}="${key}"`); return recs.length?JSON.parse(recs[0].fields.Value||"null"):null; }
  async setConfig(key,val) { const recs=await this.all("Config",`{Key}="${key}"`); const v=JSON.stringify(val); if(recs.length)await this.update("Config",recs[0].id,{Key:key,Value:v}); else await this.create("Config",{Key:key,Value:v}); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA SETUP
// ─────────────────────────────────────────────────────────────────────────────
const SCHEMA = [
  { name:"Config", fields:[{name:"Key",type:"singleLineText"},{name:"Value",type:"multilineText"}] },
  { name:"Families", fields:[
    {name:"LID",type:"singleLineText"},{name:"Name",type:"singleLineText"},
    {name:"Address",type:"singleLineText"},{name:"City",type:"singleLineText"},
    {name:"Table",type:"singleLineText"},{name:"Accommodation",type:"singleLineText"},
    {name:"AccomNotes",type:"singleLineText"},{name:"Notes",type:"multilineText"},
    {name:"SaveTheDateSent",type:"checkbox",options:{icon:"check",color:"greenBright"}},
    {name:"InviteSent",type:"checkbox",options:{icon:"check",color:"blueBright"}},
    {name:"Hotel",type:"singleLineText"},{name:"RoomNumber",type:"singleLineText"},
    {name:"CheckIn",type:"singleLineText"},{name:"CheckOut",type:"singleLineText"},
    {name:"NeedsRide",type:"checkbox",options:{icon:"check",color:"yellowBright"}},
    {name:"RideFrom",type:"singleLineText"},{name:"RideTo",type:"singleLineText"},
    ...EVENTS.flatMap(e=>[
      {name:`Invited_${e.id}`,type:"checkbox",options:{icon:"check",color:"greenBright"}},
      {name:`RSVP_${e.id}`,type:"singleLineText"},
    ])
  ]},
  { name:"Members", fields:[
    {name:"LID",type:"singleLineText"},{name:"FamLID",type:"singleLineText"},
    {name:"FamName",type:"singleLineText"},{name:"Name",type:"singleLineText"},
    {name:"Type",type:"singleLineText"},{name:"Meal",type:"singleLineText"},
  ]},
  { name:"Expenses", fields:[
    {name:"LID",type:"singleLineText"},{name:"Description",type:"singleLineText"},
    {name:"Category",type:"singleLineText"},{name:"Amount",type:"number",options:{precision:2}},
  ]},
  { name:"CateringPrices", fields:[
    {name:"Key",type:"singleLineText"},{name:"Price",type:"number",options:{precision:2}},
  ]},
  { name:"Vendors", fields:[
    {name:"LID",type:"singleLineText"},{name:"Name",type:"singleLineText"},
    {name:"Category",type:"singleLineText"},{name:"Contact",type:"singleLineText"},
    {name:"Phone",type:"singleLineText"},{name:"Email",type:"singleLineText"},
    {name:"Status",type:"singleLineText"},{name:"Notes",type:"multilineText"},
  ]},
  { name:"Gifts", fields:[
    {name:"LID",type:"singleLineText"},{name:"GiverID",type:"singleLineText"},
    {name:"GiverLabel",type:"singleLineText"},{name:"Description",type:"singleLineText"},
    {name:"Amount",type:"number",options:{precision:2}},
    {name:"ThankYou",type:"checkbox",options:{icon:"check",color:"greenBright"}},
    {name:"Notes",type:"singleLineText"},
  ]},
  { name:"RunOfShow", fields:[
    {name:"LID",type:"singleLineText"},{name:"EventID",type:"singleLineText"},
    {name:"Time",type:"singleLineText"},{name:"Item",type:"singleLineText"},
    {name:"Notes",type:"singleLineText"},{name:"Order",type:"number",options:{precision:0}},
  ]},
  { name:"Aliyot", fields:[
    {name:"LID",type:"singleLineText"},{name:"Order",type:"number",options:{precision:0}},
    {name:"Name",type:"singleLineText"},{name:"AliyahName",type:"singleLineText"},
    {name:"Section",type:"singleLineText"},{name:"Notes",type:"singleLineText"},
    {name:"Relationship",type:"singleLineText"},
  ]},
  { name:"Tasks", fields:[
    {name:"LID",type:"singleLineText"},{name:"Task",type:"singleLineText"},
    {name:"Due",type:"singleLineText"},{name:"Done",type:"checkbox",options:{icon:"check",color:"greenBright"}},
    {name:"Order",type:"number",options:{precision:0}},
  ]},
  { name:"Hotels", fields:[
    {name:"LID",type:"singleLineText"},{name:"Name",type:"singleLineText"},
    {name:"Address",type:"singleLineText"},{name:"Phone",type:"singleLineText"},
    {name:"BlockSize",type:"number",options:{precision:0}},{name:"BlockUsed",type:"number",options:{precision:0}},
    {name:"Notes",type:"singleLineText"},
  ]},
  { name:"TorahInfo", fields:[
    {name:"Key",type:"singleLineText"},{name:"Value",type:"multilineText"},
  ]},
];

const DEFAULT_TASKS = [
  "Book venue","Choose caterer","Book DJ / band","Book photographer",
  "Send save-the-dates","Order invitations","Send invitations",
  "Torah portion prep begins","Finalise guest list & seating","Final fittings"
].map((t,i)=>({ task:t, due:["Jan 2026","Mar 2026","Apr 2026","Apr 2026","Jun 2026","Aug 2026","Sep 2026","Jan 2027","Sep 2027","Oct 2027"][i], done:false, order:i }));

async function setupSchema(api, setProgress) {
  const { tables } = await api.getTables();
  const existing = tables.map(t=>t.name);
  for (const s of SCHEMA) {
    if (!existing.includes(s.name)) {
      setProgress(`Creating ${s.name} table…`);
      await api.createTable(s.name, s.fields);
    }
  }
  // Seed tasks
  const taskRecs = await api.all("Tasks");
  if (taskRecs.length===0) {
    setProgress("Seeding default tasks…");
    for (const t of DEFAULT_TASKS) {
      await api.create("Tasks", { LID:uid(), Task:t.task, Due:t.due, Done:false, Order:t.order });
      await new Promise(r=>setTimeout(r,80));
    }
  }
  // Seed catering prices
  const cpRecs = await api.all("CateringPrices");
  if (cpRecs.length===0) {
    const defaults = ["Chicken","Fish","Vegetarian","Kids Meal","friday_perhead","service_perhead","brunch_perhead"];
    for (const k of defaults) {
      await api.create("CateringPrices", { Key:k, Price:0 });
      await new Promise(r=>setTimeout(r,80));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD ALL DATA
// ─────────────────────────────────────────────────────────────────────────────
async function loadAll(api) {
  const [famRecs,memRecs,expRecs,cpRecs,vendRecs,giftRecs,rosRecs,alRecs,taskRecs,hotelRecs,torahRecs] = await Promise.all([
    api.all("Families"), api.all("Members"), api.all("Expenses"),
    api.all("CateringPrices"), api.all("Vendors"), api.all("Gifts"),
    api.all("RunOfShow"), api.all("Aliyot"), api.all("Tasks"),
    api.all("Hotels"), api.all("TorahInfo"),
  ]);

  const families = famRecs.map(r=>({
    _id:r.id, id:r.fields.LID||r.id,
    name:r.fields.Name||"", address:r.fields.Address||"", city:r.fields.City||"",
    table:r.fields.Table||"", accommodation:r.fields.Accommodation||"",
    accomNotes:r.fields.AccomNotes||"", notes:r.fields.Notes||"",
    saveTheDateSent:!!r.fields.SaveTheDateSent, inviteSent:!!r.fields.InviteSent,
    hotel:r.fields.Hotel||"", roomNumber:r.fields.RoomNumber||"",
    checkIn:r.fields.CheckIn||"", checkOut:r.fields.CheckOut||"",
    needsRide:!!r.fields.NeedsRide, rideFrom:r.fields.RideFrom||"", rideTo:r.fields.RideTo||"",
    invited:{ friday:!!r.fields.Invited_friday, service:!!r.fields.Invited_service, party:!!r.fields.Invited_party, brunch:!!r.fields.Invited_brunch },
    rsvps:{ friday:r.fields.RSVP_friday||"", service:r.fields.RSVP_service||"", party:r.fields.RSVP_party||"", brunch:r.fields.RSVP_brunch||"" },
    members:[],
  }));

  memRecs.forEach(r=>{
    const f=families.find(x=>x.id===r.fields.FamLID);
    if(f) f.members.push({ _id:r.id, id:r.fields.LID||r.id, name:r.fields.Name||"", type:r.fields.Type||"adult", meal:r.fields.Meal||"" });
  });

  const expenses = expRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, description:r.fields.Description||"", category:r.fields.Category||"", amount:r.fields.Amount||0 }));

  const cateringPrices = {};
  cpRecs.forEach(r=>{ cateringPrices[r.fields.Key] = { _id:r.id, price:r.fields.Price||0 }; });

  const vendors = vendRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, name:r.fields.Name||"", category:r.fields.Category||"", contact:r.fields.Contact||"", phone:r.fields.Phone||"", email:r.fields.Email||"", status:r.fields.Status||"researching", notes:r.fields.Notes||"" }));

  const gifts = giftRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, giverId:r.fields.GiverID||"", giverLabel:r.fields.GiverLabel||"", description:r.fields.Description||"", amount:r.fields.Amount||0, thankyou:!!r.fields.ThankYou, notes:r.fields.Notes||"" }));

  const runOfShow = rosRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, eventId:r.fields.EventID||"", time:r.fields.Time||"", item:r.fields.Item||"", notes:r.fields.Notes||"", order:r.fields.Order||0 })).sort((a,b)=>a.order-b.order);

  const aliyot = alRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, order:r.fields.Order||0, name:r.fields.Name||"", aliyahName:r.fields.AliyahName||"", section:r.fields.Section||"", notes:r.fields.Notes||"", relationship:r.fields.Relationship||"" })).sort((a,b)=>a.order-b.order);

  const tasks = taskRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, task:r.fields.Task||"", due:r.fields.Due||"", done:!!r.fields.Done, order:r.fields.Order||0 })).sort((a,b)=>a.order-b.order);

  const hotels = hotelRecs.map(r=>({ _id:r.id, id:r.fields.LID||r.id, name:r.fields.Name||"", address:r.fields.Address||"", phone:r.fields.Phone||"", blockSize:r.fields.BlockSize||0, blockUsed:r.fields.BlockUsed||0, notes:r.fields.Notes||"" }));

  const torah = {};
  torahRecs.forEach(r=>{ torah[r.fields.Key] = { _id:r.id, value:r.fields.Value||"" }; });

  return { families, expenses, cateringPrices, vendors, gifts, runOfShow, aliyot, tasks, hotels, torah };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }) {
  const [token, setToken] = useState(localStorage.getItem("bm_token")||"");
  const [step, setStep] = useState("form");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const connect = async () => {
    if (!token.trim()) return;
    setError(""); setStep("loading"); setProgress("Validating token…");
    try {
      const tempApi = new AT(token.trim(), null);
      const { bases, workspaces } = await tempApi.listBases();
      const wsId = workspaces?.[0]?.id;
      if (!wsId) throw new Error("No workspace found on this account");
      setProgress("Creating Bar Mitzvah base…");
      const base = await tempApi.createBase("Bar Mitzvah 2027", wsId);
      const api = new AT(token.trim(), base.id);
      await setupSchema(api, setProgress);
      localStorage.setItem("bm_token", token.trim());
      localStorage.setItem("bm_baseId", base.id);
      setProgress("All done! Loading your planner…");
      setTimeout(()=>onConnect(token.trim(), base.id), 800);
    } catch(e) {
      setError(e.message); setStep("form");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(150deg, ${NAVY} 0%, #2e4a8a 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background:"#fff", borderRadius:24, padding:"44px 48px", maxWidth:520, width:"100%", boxShadow:"0 32px 80px rgba(0,0,0,.35)" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>✡️</div>
          <h1 style={{ fontFamily:F, fontSize:32, color:NAVY, margin:"0 0 8px", fontWeight:600 }}>Bar Mitzvah Planner</h1>
          <p style={{ color:"#6b7280", fontFamily:FB, fontSize:14, margin:0 }}>Connect your Airtable to get started</p>
        </div>
        {step==="form" && <>
          <div style={{ background:"#f0f4ff", border:"1px solid #c7d7fd", borderRadius:12, padding:"14px 16px", marginBottom:24, fontSize:13, color:"#374151", lineHeight:1.7, fontFamily:FB }}>
            Go to <a href="https://airtable.com/create/tokens" target="_blank" rel="noreferrer" style={{ color:NAVY, fontWeight:600 }}>airtable.com/create/tokens</a> and create a token with scopes: <code style={{ background:"#e8edf5", padding:"1px 5px", borderRadius:4, fontSize:12 }}>data.records:read</code> <code style={{ background:"#e8edf5", padding:"1px 5px", borderRadius:4, fontSize:12 }}>data.records:write</code> <code style={{ background:"#e8edf5", padding:"1px 5px", borderRadius:4, fontSize:12 }}>schema.bases:read</code> <code style={{ background:"#e8edf5", padding:"1px 5px", borderRadius:4, fontSize:12 }}>schema.bases:write</code>
          </div>
          <div style={lS}>Airtable API Token</div>
          <input type="password" placeholder="pat_xxxxxxxxxxxxxxxxxx" value={token} onChange={e=>setToken(e.target.value)} onKeyDown={e=>e.key==="Enter"&&connect()} style={{ ...iS(), marginBottom:16, fontSize:14 }} />
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, fontFamily:FB }}>{error}</div>}
          <button onClick={connect} style={{ ...btn("primary"), width:"100%", padding:"14px", fontSize:15, fontFamily:F, fontWeight:600 }}>Connect & Set Up Airtable →</button>
        </>}
        {step==="loading" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:16 }}>⚙️</div>
            <div style={{ fontFamily:F, color:NAVY, fontSize:20, marginBottom:8 }}>Setting up your planner…</div>
            <div style={{ color:"#6b7280", fontFamily:FB, fontSize:14 }}>{progress}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN
// ─────────────────────────────────────────────────────────────────────────────
function Countdown() {
  const days = Math.max(0, Math.floor((BAR_MITZVAH_DATE - new Date()) / 86400000));
  return (
    <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
      {[{l:"Days",v:days},{l:"Weeks",v:Math.floor(days/7)},{l:"Months",v:Math.floor(days/30)}].map(({l,v})=>(
        <div key={l} style={{ background:`linear-gradient(150deg,${NAVY} 0%,#2a3f6f 100%)`, color:"#fff", borderRadius:18, padding:"20px 32px", textAlign:"center", minWidth:100, boxShadow:`0 8px 28px rgba(26,39,68,.25)` }}>
          <div style={{ fontSize:40, fontFamily:F, fontWeight:700, color:GOLD, lineHeight:1 }}>{v}</div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", opacity:.7, marginTop:5, fontFamily:FB }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ families, expenses, cateringPrices, tasks, gifts }) {
  const allMembers = families.flatMap(f=>f.members||[]);
  const confirmedFamilies = families.filter(f=>Object.values(f.rsvps||{}).some(r=>r==="yes")).length;
  const totalExpenses = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalGifts = gifts.reduce((s,g)=>s+Number(g.amount||0),0);
  const tasksDone = tasks.filter(t=>t.done).length;
  const mealCounts = {};
  MEAL_OPTIONS.forEach(m=>{mealCounts[m]=0;});
  families.filter(f=>(f.rsvps||{}).party==="yes").flatMap(f=>f.members||[]).forEach(m=>{ if(m.meal) mealCounts[m.meal]=(mealCounts[m.meal]||0)+1; });

  // catering estimate
  let cateringEst = 0;
  MEAL_OPTIONS.forEach(m=>{ const cp=cateringPrices[m]; if(cp) cateringEst+=mealCounts[m]*Number(cp.price||0); });
  EVENTS.filter(e=>e.id!=="party").forEach(ev=>{ const cp=cateringPrices[`${ev.id}_perhead`]; if(cp){ const count=families.filter(f=>(f.invited||{})[ev.id]&&(f.rsvps||{})[ev.id]==="yes").reduce((s,f)=>s+(f.members||[]).length,0); cateringEst+=count*Number(cp.price||0); }});

  const grandTotal = totalExpenses + cateringEst;

  const stats = [
    { label:"Total Guests", value:allMembers.length, sub:`${families.length} families` },
    { label:"Families Confirmed", value:confirmedFamilies, sub:`of ${families.length}` },
    { label:"Total Spend", value:`$${grandTotal.toLocaleString()}`, sub:`incl. catering est.` },
    { label:"Tasks Done", value:`${tasksDone}/${tasks.length}`, sub:"on timeline" },
    { label:"Gifts Received", value:`$${totalGifts.toLocaleString()}`, sub:`${gifts.length} logged` },
  ];

  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <h2 style={{ fontFamily:F, color:NAVY, fontSize:28, margin:"0 0 6px", fontWeight:600 }}>November 6, 2027</h2>
        <p style={{ color:"#6b7280", fontFamily:FB, fontSize:14, margin:"0 0 28px" }}>The Big Day</p>
        <Countdown />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:28 }}>
        {stats.map(({label,value,sub})=>(
          <div key={label} style={card()}>
            <div style={{ fontSize:28, fontFamily:F, fontWeight:700, color:NAVY }}>{value}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2, fontFamily:FB }}>{label}</div>
            <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginTop:2, fontFamily:FB }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={card()}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, marginBottom:14, fontSize:17 }}>Events</div>
          {EVENTS.map(ev=>{
            const attending=families.filter(f=>(f.invited||{})[ev.id]&&(f.rsvps||{})[ev.id]==="yes").reduce((s,f)=>s+(f.members||[]).length,0);
            const invited=families.filter(f=>(f.invited||{})[ev.id]).reduce((s,f)=>s+(f.members||[]).length,0);
            return (
              <div key={ev.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${BORDER}`, fontFamily:FB, fontSize:13 }}>
                <span style={{ color:"#374151" }}>{ev.icon} {ev.name}</span>
                <span style={{ fontWeight:600, color:GOLD }}>{attending} / {invited}</span>
              </div>
            );
          })}
        </div>
        <div style={card()}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, marginBottom:14, fontSize:17 }}>Saturday Night Meals</div>
          {Object.entries(mealCounts).map(([meal,count])=>(
            <div key={meal} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${BORDER}`, fontFamily:FB, fontSize:13 }}>
              <span style={{ color:"#374151" }}>{meal}</span>
              <span style={{ fontWeight:600, color:NAVY }}>{count}</span>
            </div>
          ))}
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:8, fontFamily:FB }}>
            {families.filter(f=>(f.rsvps||{}).party==="yes").flatMap(f=>f.members||[]).filter(m=>!m.meal).length} not yet selected
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILIES TAB
// ─────────────────────────────────────────────────────────────────────────────
function FamiliesTab({ families, setFamilies, api }) {
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyFam());
  const [search, setSearch] = useState("");
  const [newMemberInputs, setNewMemberInputs] = useState({});
  const [saving, setSaving] = useState(false);

  function emptyFam() {
    return { name:"", address:"", city:"", table:"", accommodation:"", accomNotes:"", notes:"",
      saveTheDateSent:false, inviteSent:false, hotel:"", roomNumber:"", checkIn:"", checkOut:"",
      needsRide:false, rideFrom:"", rideTo:"",
      invited:{ friday:false, service:true, party:true, brunch:false },
      rsvps:{ friday:"", service:"", party:"", brunch:"" },
      members:[] };
  }

  const famToFields = (f) => ({
    Name:f.name, Address:f.address, City:f.city, Table:f.table,
    Accommodation:f.accommodation, AccomNotes:f.accomNotes, Notes:f.notes,
    SaveTheDateSent:!!f.saveTheDateSent, InviteSent:!!f.inviteSent,
    Hotel:f.hotel, RoomNumber:f.roomNumber, CheckIn:f.checkIn, CheckOut:f.checkOut,
    NeedsRide:!!f.needsRide, RideFrom:f.rideFrom, RideTo:f.rideTo,
    Invited_friday:!!(f.invited||{}).friday, Invited_service:!!(f.invited||{}).service,
    Invited_party:!!(f.invited||{}).party, Invited_brunch:!!(f.invited||{}).brunch,
    RSVP_friday:(f.rsvps||{}).friday||"", RSVP_service:(f.rsvps||{}).service||"",
    RSVP_party:(f.rsvps||{}).party||"", RSVP_brunch:(f.rsvps||{}).brunch||"",
  });

  const saveFamily = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const fam = families.find(f=>f.id===editId);
        if (fam?._id) {
          await api.update("Families", fam._id, famToFields(form));
          // sync members
          const oldMembers = fam.members||[];
          const newMembers = form.members||[];
          for (const om of oldMembers) {
            if (!newMembers.find(m=>m.id===om.id) && om._id) await api.del("Members", om._id);
          }
          for (const nm of newMembers) {
            const existing = oldMembers.find(m=>m.id===nm.id);
            const mf = { Name:nm.name, Type:nm.type||"adult", Meal:nm.meal||"", FamLID:editId, FamName:form.name, LID:nm.id };
            if (existing?._id) await api.update("Members", existing._id, mf);
            else await api.create("Members", mf);
            await new Promise(r=>setTimeout(r,80));
          }
        }
        setFamilies(families.map(f=>f.id===editId?{...f,...form,id:editId,_id:f._id}:f));
      } else {
        const lid = uid();
        const rec = await api.create("Families", { ...famToFields(form), LID:lid });
        const newFam = { ...form, id:lid, _id:rec.id, members:[] };
        for (const m of form.members||[]) {
          const mr = await api.create("Members", { Name:m.name, Type:m.type||"adult", Meal:m.meal||"", FamLID:lid, FamName:form.name, LID:m.id });
          newFam.members.push({ ...m, _id:mr.id });
          await new Promise(r=>setTimeout(r,80));
        }
        setFamilies([...families, newFam]);
      }
      setShowForm(false); setEditId(null); setForm(emptyFam());
    } catch(e) { alert("Error saving: "+e.message); }
    setSaving(false);
  };

  const deleteFam = async (fam) => {
    if (!window.confirm(`Remove ${fam.name}?`)) return;
    for (const m of fam.members||[]) { if(m._id) { await api.del("Members",m._id); await new Promise(r=>setTimeout(r,80)); }}
    if (fam._id) await api.del("Families", fam._id);
    setFamilies(families.filter(f=>f.id!==fam.id));
  };

  const quickUpdate = async (fam, fields) => {
    setFamilies(families.map(f=>f.id===fam.id?{...f,...fields}:f));
    const atFields = {};
    if ("rsvps" in fields) {
      const r={...fam.rsvps,...fields.rsvps};
      atFields.RSVP_friday=r.friday||""; atFields.RSVP_service=r.service||"";
      atFields.RSVP_party=r.party||""; atFields.RSVP_brunch=r.brunch||"";
    }
    if ("invited" in fields) {
      const inv={...fam.invited,...fields.invited};
      atFields.Invited_friday=!!inv.friday; atFields.Invited_service=!!inv.service;
      atFields.Invited_party=!!inv.party; atFields.Invited_brunch=!!inv.brunch;
    }
    if ("saveTheDateSent" in fields) atFields.SaveTheDateSent=!!fields.saveTheDateSent;
    if ("inviteSent" in fields) atFields.InviteSent=!!fields.inviteSent;
    if (fam._id && Object.keys(atFields).length) {
      try { await api.update("Families", fam._id, atFields); } catch(e) { console.error(e); }
    }
  };

  const addMember = async (famId, name) => {
    if (!name.trim()) return;
    const fam = families.find(f=>f.id===famId);
    if (!fam) return;
    const lid = uid();
    try {
      const rec = await api.create("Members", { Name:name.trim(), Type:"adult", Meal:"", FamLID:famId, FamName:fam.name, LID:lid });
      const mem = { _id:rec.id, id:lid, name:name.trim(), type:"adult", meal:"" };
      setFamilies(families.map(f=>f.id===famId?{...f,members:[...(f.members||[]),mem]}:f));
    } catch(e) { alert("Error: "+e.message); }
  };

  const updateMember = async (famId, mem, field, val) => {
    setFamilies(families.map(f=>f.id===famId?{...f,members:(f.members||[]).map(m=>m.id===mem.id?{...m,[field]:val}:m)}:f));
    if (mem._id) {
      try { await api.update("Members", mem._id, { [field==="type"?"Type":field==="meal"?"Meal":"Name"]:val }); } catch(e) {}
    }
  };

  const deleteMember = async (famId, mem) => {
    setFamilies(families.map(f=>f.id===famId?{...f,members:(f.members||[]).filter(m=>m.id!==mem.id)}:f));
    if (mem._id) { try { await api.del("Members", mem._id); } catch(e) {} }
  };

  const filtered = families.filter(f=>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.members||[]).some(m=>m.name.toLowerCase().includes(search.toLowerCase()))
  );

  const allMembers = families.flatMap(f=>f.members||[]);
  const adults = allMembers.filter(m=>m.type==="adult").length;
  const kids = allMembers.filter(m=>m.type==="child").length;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...iS(), width:200 }} />
          <span style={{ fontSize:13, color:"#6b7280", fontFamily:FB }}>{families.length} families · {allMembers.length} guests ({adults} adults, {kids} kids)</span>
        </div>
        <button onClick={()=>{setForm(emptyFam());setEditId(null);setShowForm(true);setExpanded(null);}} style={btn("primary")}>+ Add Family</button>
      </div>

      {showForm && (
        <div style={{ ...card(), border:`2px solid ${GOLD}`, marginBottom:20 }}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18, marginBottom:18 }}>{editId?"Edit Family":"New Family"}</div>
          
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            <div><div style={lS}>Family Name *</div><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Table</div><input value={form.table} onChange={e=>setForm({...form,table:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Street Address</div><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>City / Country</div><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Accommodation</div>
              <select value={form.accommodation} onChange={e=>setForm({...form,accommodation:e.target.value})} style={iS()}>
                <option value="">Select…</option>
                {ACCOMMODATION_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><div style={lS}>Accommodation Notes</div><input value={form.accomNotes} onChange={e=>setForm({...form,accomNotes:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Hotel Name</div><input value={form.hotel} onChange={e=>setForm({...form,hotel:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Room Number</div><input value={form.roomNumber} onChange={e=>setForm({...form,roomNumber:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Check-in Date</div><input value={form.checkIn} onChange={e=>setForm({...form,checkIn:e.target.value})} style={iS()} placeholder="e.g. Nov 5" /></div>
            <div><div style={lS}>Check-out Date</div><input value={form.checkOut} onChange={e=>setForm({...form,checkOut:e.target.value})} style={iS()} placeholder="e.g. Nov 7" /></div>
            <div style={{ gridColumn:"span 2" }}><div style={lS}>Notes</div><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{ ...iS(), resize:"vertical" }} /></div>
          </div>

          {/* Invited + RSVP */}
          <div style={{ marginBottom:16 }}>
            <div style={lS}>Invited to Events & RSVP</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {EVENTS.map(ev=>(
                <div key={ev.id} style={{ background:"#f9fafb", borderRadius:10, padding:"10px 14px", border:`1px solid ${BORDER}` }}>
                  <div style={{ fontFamily:FB, fontSize:12, fontWeight:600, color:NAVY, marginBottom:6 }}>{ev.icon} {ev.name}</div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontFamily:FB, marginBottom:6, cursor:"pointer" }}>
                    <input type="checkbox" checked={!!(form.invited||{})[ev.id]} onChange={e=>setForm({...form,invited:{...(form.invited||{}),[ev.id]:e.target.checked}})} />
                    Invited
                  </label>
                  {(form.invited||{})[ev.id] && (
                    <select value={(form.rsvps||{})[ev.id]||""} onChange={e=>setForm({...form,rsvps:{...(form.rsvps||{}),[ev.id]:e.target.value}})} style={{ ...iS({ width:"auto", padding:"4px 8px", fontSize:12 }) }}>
                      <option value="">RSVP —</option>
                      <option value="yes">Yes ✓</option>
                      <option value="no">No ✗</option>
                      <option value="maybe">Maybe</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Transportation */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontFamily:FB, cursor:"pointer", marginBottom:8 }}>
              <input type="checkbox" checked={!!form.needsRide} onChange={e=>setForm({...form,needsRide:e.target.checked})} />
              <span style={{ fontWeight:600 }}>Needs transportation</span>
            </label>
            {form.needsRide && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginLeft:22 }}>
                <div><div style={lS}>From</div><input value={form.rideFrom} onChange={e=>setForm({...form,rideFrom:e.target.value})} style={iS()} placeholder="e.g. Marriott Hotel" /></div>
                <div><div style={lS}>To</div><input value={form.rideTo} onChange={e=>setForm({...form,rideTo:e.target.value})} style={iS()} placeholder="e.g. Synagogue" /></div>
              </div>
            )}
          </div>

          {/* Members */}
          <div style={{ marginBottom:16 }}>
            <div style={lS}>Family Members</div>
            {(form.members||[]).map((m,i)=>(
              <div key={m.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:LIGHT_GOLD, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:NAVY, flexShrink:0, fontFamily:F }}>
                  {(m.name||"?").charAt(0).toUpperCase()}
                </div>
                <input value={m.name} onChange={e=>setForm({...form,members:form.members.map((x,xi)=>xi===i?{...x,name:e.target.value}:x)})} placeholder="Name" style={{ ...iS(), flex:1 }} />
                <select value={m.type||"adult"} onChange={e=>setForm({...form,members:form.members.map((x,xi)=>xi===i?{...x,type:e.target.value}:x)})} style={{ ...iS({ width:100 }) }}>
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                </select>
                <select value={m.meal||""} onChange={e=>setForm({...form,members:form.members.map((x,xi)=>xi===i?{...x,meal:e.target.value}:x)})} style={{ ...iS({ width:130 }) }}>
                  <option value="">Meal…</option>
                  {MEAL_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={()=>setForm({...form,members:form.members.filter((_,xi)=>xi!==i)})} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:20, flexShrink:0 }}>×</button>
              </div>
            ))}
            <button onClick={()=>setForm({...form,members:[...(form.members||[]),{id:uid(),name:"",type:"adult",meal:""}]})}
              style={{ background:"none", border:`1px dashed ${BORDER}`, borderRadius:8, padding:"7px 14px", cursor:"pointer", color:"#6b7280", fontSize:13, fontFamily:FB, marginTop:4 }}>
              + Add Member
            </button>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={saveFamily} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>{saving?"Saving…":(editId?"Update Family":"Add Family")}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null);}} style={btn("ghost")}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length===0 && !showForm && <div style={{ textAlign:"center", padding:50, color:"#9ca3af", fontFamily:FB }}>No families yet — click "Add Family" to get started!</div>}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(fam=>{
          const isOpen = expanded===fam.id;
          const members = fam.members||[];
          const mealsDone = members.filter(m=>m.meal).length;
          const invitedCount = EVENTS.filter(e=>(fam.invited||{})[e.id]).length;
          return (
            <div key={fam.id} style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden", boxShadow:"0 2px 10px rgba(26,39,68,.05)" }}>
              <div onClick={()=>setExpanded(isOpen?null:fam.id)} style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, cursor:"pointer", userSelect:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${NAVY},#2a3f6f)`, display:"flex", alignItems:"center", justifyContent:"center", color:GOLD, fontFamily:F, fontWeight:700, fontSize:19, flexShrink:0 }}>
                    {fam.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, color:NAVY, fontSize:15, fontFamily:FB }}>{fam.name}</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:2, fontFamily:FB }}>
                      {members.length} member{members.length!==1?"s":""}
                      {` · ${members.filter(m=>m.type==="adult").length}A ${members.filter(m=>m.type==="child").length}K`}
                      {fam.table?` · Table ${fam.table}`:""}
                      {fam.city?` · ${fam.city}`:""}
                      {members.length>0?` · ${mealsDone}/${members.length} meals`:""}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                  {/* Invite badges */}
                  <span style={{ fontSize:11, padding:"2px 7px", borderRadius:8, background:fam.saveTheDateSent?"#f0fdf4":"#f9fafb", color:fam.saveTheDateSent?"#16a34a":"#9ca3af", border:`1px solid ${BORDER}`, fontFamily:FB, fontWeight:600 }}>
                    {fam.saveTheDateSent?"✓ STD":"STD"}
                  </span>
                  <span style={{ fontSize:11, padding:"2px 7px", borderRadius:8, background:fam.inviteSent?"#eff6ff":"#f9fafb", color:fam.inviteSent?"#2563eb":"#9ca3af", border:`1px solid ${BORDER}`, fontFamily:FB, fontWeight:600 }}>
                    {fam.inviteSent?"✓ Invite":"Invite"}
                  </span>
                  {EVENTS.map(ev=>{
                    const invited=(fam.invited||{})[ev.id];
                    const r=(fam.rsvps||{})[ev.id]||"";
                    if(!invited) return null;
                    const s=RSVP_STYLE[r]||RSVP_STYLE[""];
                    return (
                      <span key={ev.id} style={{ fontSize:11, padding:"2px 8px", borderRadius:8, background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontFamily:FB, fontWeight:600 }}>
                        {ev.icon} {r?r.charAt(0).toUpperCase()+r.slice(1):"—"}
                      </span>
                    );
                  })}
                  <span style={{ color:"#9ca3af", fontSize:12, marginLeft:4 }}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop:`1px solid ${BORDER}`, background:"#fafaf9" }}>
                  {/* Detail grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:16, padding:"16px 18px", borderBottom:`1px solid ${BORDER}` }}>
                    <div><div style={lS}>📍 Address</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.address||"—"}{fam.city?`, ${fam.city}`:""}</div></div>
                    <div><div style={lS}>🪑 Table</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.table||"Not assigned"}</div></div>
                    <div><div style={lS}>🏨 Accommodation</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.accommodation||"Not specified"}</div>{fam.accomNotes&&<div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{fam.accomNotes}</div>}</div>
                    {(fam.hotel||fam.roomNumber) && <div><div style={lS}>🛏 Hotel Details</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.hotel}{fam.roomNumber?` · Room ${fam.roomNumber}`:""}</div>{(fam.checkIn||fam.checkOut)&&<div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{fam.checkIn} → {fam.checkOut}</div>}</div>}
                    {fam.needsRide && <div><div style={lS}>🚗 Transport</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.rideFrom} → {fam.rideTo}</div></div>}
                    {fam.notes&&<div><div style={lS}>📝 Notes</div><div style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{fam.notes}</div></div>}
                  </div>

                  {/* Invite status */}
                  <div style={{ padding:"12px 18px", borderBottom:`1px solid ${BORDER}` }}>
                    <div style={lS}>Invitation Status</div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontFamily:FB, cursor:"pointer" }}>
                        <input type="checkbox" checked={!!fam.saveTheDateSent} onChange={e=>quickUpdate(fam,{saveTheDateSent:e.target.checked})} />
                        Save-the-date sent
                      </label>
                      <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontFamily:FB, cursor:"pointer" }}>
                        <input type="checkbox" checked={!!fam.inviteSent} onChange={e=>quickUpdate(fam,{inviteSent:e.target.checked})} />
                        Invitation sent
                      </label>
                    </div>
                  </div>

                  {/* Events invited/RSVP */}
                  <div style={{ padding:"12px 18px", borderBottom:`1px solid ${BORDER}` }}>
                    <div style={lS}>Events</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                      {EVENTS.map(ev=>{
                        const invited=!!(fam.invited||{})[ev.id];
                        const r=(fam.rsvps||{})[ev.id]||"";
                        return (
                          <div key={ev.id} style={{ background:"#f9fafb", borderRadius:10, padding:"8px 12px", border:`1px solid ${BORDER}`, minWidth:140 }}>
                            <div style={{ fontFamily:FB, fontSize:12, fontWeight:600, color:NAVY, marginBottom:6 }}>{ev.icon} {ev.name}</div>
                            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontFamily:FB, marginBottom:invited?6:0, cursor:"pointer" }}>
                              <input type="checkbox" checked={invited} onChange={e=>quickUpdate(fam,{invited:{...(fam.invited||{}),[ev.id]:e.target.checked}})} />
                              Invited
                            </label>
                            {invited && (
                              <select value={r} onChange={e=>quickUpdate(fam,{rsvps:{...(fam.rsvps||{}),[ev.id]:e.target.value}})} style={{ ...iS({ width:"100%", padding:"4px 8px", fontSize:12 }) }}>
                                <option value="">RSVP —</option>
                                <option value="yes">Yes ✓</option>
                                <option value="no">No ✗</option>
                                <option value="maybe">Maybe</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Members */}
                  <div style={{ padding:"14px 18px", borderBottom:`1px solid ${BORDER}` }}>
                    <div style={lS}>Members & Saturday Night Meal</div>
                    {members.length===0&&<div style={{ fontSize:13, color:"#9ca3af", fontFamily:FB, marginBottom:10 }}>No members yet.</div>}
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
                      {members.map(m=>(
                        <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:LIGHT_GOLD, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:NAVY, flexShrink:0, fontFamily:F }}>
                            {(m.name||"?").charAt(0).toUpperCase()}
                          </div>
                          <input value={m.name} onChange={e=>updateMember(fam.id,m,"name",e.target.value)} style={{ ...iS({ flex:1, fontSize:13 }) }} />
                          <select value={m.type||"adult"} onChange={e=>updateMember(fam.id,m,"type",e.target.value)} style={{ ...iS({ width:90, fontSize:12 }) }}>
                            <option value="adult">Adult</option>
                            <option value="child">Child</option>
                          </select>
                          <select value={m.meal||""} onChange={e=>updateMember(fam.id,m,"meal",e.target.value)} style={{ ...iS({ width:130, fontSize:12, color:m.meal?NAVY:"#9ca3af" }) }}>
                            <option value="">Meal…</option>
                            {MEAL_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                          <button onClick={()=>deleteMember(fam.id,m)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:20, flexShrink:0 }}>×</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input placeholder="Add member name, press Enter…" value={newMemberInputs[fam.id]||""}
                        onChange={e=>setNewMemberInputs({...newMemberInputs,[fam.id]:e.target.value})}
                        onKeyDown={e=>{if(e.key==="Enter"){addMember(fam.id,newMemberInputs[fam.id]||"");setNewMemberInputs({...newMemberInputs,[fam.id]:""}); }}}
                        style={{ ...iS({ flex:1, fontSize:13 }) }} />
                      <button onClick={()=>{addMember(fam.id,newMemberInputs[fam.id]||"");setNewMemberInputs({...newMemberInputs,[fam.id]:""}); }} style={btn("primary",{ whiteSpace:"nowrap" })}>+ Add</button>
                    </div>
                  </div>

                  <div style={{ padding:"10px 18px", display:"flex", gap:10 }}>
                    <button onClick={()=>{setForm({...fam,members:(fam.members||[]).map(m=>({...m}))});setEditId(fam.id);setShowForm(true);setExpanded(null);}} style={btn("ghost",{fontSize:13})}>Edit Details</button>
                    <button onClick={()=>deleteFam(fam)} style={btn("danger",{fontSize:13})}>Remove Family</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEATING TAB
// ─────────────────────────────────────────────────────────────────────────────
function SeatingTab({ families }) {
  const [newTable, setNewTable] = useState("");
  const [tableNames, setTableNames] = useState([]);

  // Derive tables from families
  const tableMap = {};
  families.forEach(f=>{
    const t = f.table || "Unassigned";
    if (!tableMap[t]) tableMap[t]=[];
    tableMap[t].push(f);
  });

  const tables = Object.entries(tableMap).sort(([a],[b])=>{
    if(a==="Unassigned") return 1;
    if(b==="Unassigned") return -1;
    const na=parseInt(a)||0, nb=parseInt(b)||0;
    return na-nb||a.localeCompare(b);
  });

  return (
    <div>
      <div style={{ background:LIGHT_GOLD, border:`1px solid ${GOLD}`, borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#6b5a20", fontFamily:FB }}>
        💡 Table assignments are managed from the <strong>Families & Guests</strong> tab. This view shows your current seating layout.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
        {tables.map(([tableName, fams])=>{
          const members = fams.flatMap(f=>f.members||[]);
          const adults = members.filter(m=>m.type==="adult").length;
          const kids = members.filter(m=>m.type==="child").length;
          return (
            <div key={tableName} style={card({ borderTop:`3px solid ${tableName==="Unassigned"?"#e5e7eb":GOLD}` })}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18 }}>
                  {tableName==="Unassigned"?"⚠ Unassigned":tableName.match(/^\d/)?`Table ${tableName}`:tableName}
                </div>
                <div style={{ fontFamily:FB, fontSize:12, color:"#6b7280" }}>{members.length} guests</div>
              </div>
              <div style={{ fontSize:11, color:"#9ca3af", fontFamily:FB, marginBottom:10 }}>{adults} adults · {kids} kids</div>
              {fams.map(f=>(
                <div key={f.id} style={{ marginBottom:8 }}>
                  <div style={{ fontFamily:FB, fontWeight:600, fontSize:13, color:NAVY, marginBottom:3 }}>{f.name}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(f.members||[]).map(m=>(
                      <span key={m.id} style={{ fontSize:11, padding:"2px 8px", borderRadius:8, background:m.type==="child"?"#fef9ee":LIGHT_GOLD, color:NAVY, fontFamily:FB, border:`1px solid ${BORDER}` }}>
                        {m.name}{m.type==="child"?" 👧":""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COSTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function CostsTab({ families, expenses, setExpenses, cateringPrices, setCateringPrices, api }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description:"", category:"", amount:"" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const updateCateringPrice = async (key, price) => {
    const cp = cateringPrices[key];
    setCateringPrices({ ...cateringPrices, [key]: { ...(cp||{}), price:Number(price||0) } });
    if (cp?._id) {
      try { await api.update("CateringPrices", cp._id, { Price:Number(price||0) }); } catch(e) { console.error(e); }
    }
  };

  // Calculate catering
  const partyGuests = families.filter(f=>(f.invited||{}).party&&(f.rsvps||{}).party==="yes").flatMap(f=>f.members||[]);
  const mealCounts = {};
  MEAL_OPTIONS.forEach(m=>{mealCounts[m]=0;});
  partyGuests.forEach(m=>{ if(m.meal) mealCounts[m.meal]=(mealCounts[m.meal]||0)+1; });
  let cateringTotal = 0;
  const cateringLines = [];
  MEAL_OPTIONS.forEach(m=>{ const cp=cateringPrices[m]; const count=mealCounts[m]; const price=Number(cp?.price||0); const sub=count*price; if(count>0){cateringLines.push({label:`Saturday Party — ${m} ×${count}`,amount:sub});cateringTotal+=sub;} });
  EVENTS.filter(e=>e.id!=="party").forEach(ev=>{
    const cp=cateringPrices[`${ev.id}_perhead`]; const price=Number(cp?.price||0);
    const count=families.filter(f=>(f.invited||{})[ev.id]&&(f.rsvps||{})[ev.id]==="yes").reduce((s,f)=>s+(f.members||[]).length,0);
    const sub=count*price;
    cateringLines.push({label:`${ev.name} — per head ×${count}`,amount:sub});
    cateringTotal+=sub;
  });

  const expenseTotal = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const grandTotal = cateringTotal + expenseTotal;

  const saveExpense = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const exp = expenses.find(e=>e.id===editId);
        if (exp?._id) await api.update("Expenses", exp._id, { Description:form.description, Category:form.category, Amount:Number(form.amount||0) });
        setExpenses(expenses.map(e=>e.id===editId?{...e,...form,amount:Number(form.amount||0)}:e));
      } else {
        const lid = uid();
        const rec = await api.create("Expenses", { LID:lid, Description:form.description, Category:form.category, Amount:Number(form.amount||0) });
        setExpenses([...expenses, { _id:rec.id, id:lid, description:form.description, category:form.category, amount:Number(form.amount||0) }]);
      }
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false); setForm({ description:"", category:"", amount:"" }); setShowForm(false); setEditId(null);
  };

  const delExpense = async (exp) => {
    setExpenses(expenses.filter(e=>e.id!==exp.id));
    if (exp._id) { try { await api.del("Expenses", exp._id); } catch(e) {} }
  };

  return (
    <div>
      {/* Grand total */}
      <div style={{ background:`linear-gradient(135deg,${NAVY} 0%,#2a3f6f 100%)`, borderRadius:16, padding:24, marginBottom:24, color:"#fff" }}>
        <div style={{ fontFamily:FB, fontSize:11, opacity:.65, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>Total Estimated Spend</div>
        <div style={{ fontFamily:F, fontSize:44, fontWeight:700, color:GOLD, lineHeight:1 }}>${grandTotal.toLocaleString()}</div>
        <div style={{ display:"flex", gap:24, marginTop:10, fontFamily:FB, fontSize:13, opacity:.8 }}>
          <span>Catering: ${cateringTotal.toLocaleString()}</span>
          <span>Other expenses: ${expenseTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Catering prices */}
      <div style={{ ...card(), marginBottom:20 }}>
        <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18, marginBottom:14 }}>🍽 Catering Prices</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:13, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${BORDER}` }}>Saturday Night (per meal type)</div>
            {MEAL_OPTIONS.map(m=>(
              <div key={m} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{m}</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:13, color:"#6b7280" }}>$</span>
                  <input type="number" value={cateringPrices[m]?.price||0} onChange={e=>updateCateringPrice(m,e.target.value)}
                    style={{ ...iS({ width:80, textAlign:"right" }) }} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:13, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${BORDER}` }}>Other Events (per head)</div>
            {EVENTS.filter(e=>e.id!=="party").map(ev=>(
              <div key={ev.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, color:"#374151", fontFamily:FB }}>{ev.icon} {ev.name}</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:13, color:"#6b7280" }}>$</span>
                  <input type="number" value={cateringPrices[`${ev.id}_perhead`]?.price||0} onChange={e=>updateCateringPrice(`${ev.id}_perhead`,e.target.value)}
                    style={{ ...iS({ width:80, textAlign:"right" }) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Catering breakdown */}
        <div style={{ background:"#f9faf8", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontFamily:FB, fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8, letterSpacing:.5, textTransform:"uppercase" }}>Catering Estimate Breakdown</div>
          {cateringLines.map((l,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${BORDER}`, fontFamily:FB, fontSize:13 }}>
              <span style={{ color:"#374151" }}>{l.label}</span>
              <span style={{ fontWeight:600, color:NAVY }}>${l.amount.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0", fontFamily:FB, fontSize:14, fontWeight:700, color:NAVY }}>
            <span>Total Catering</span>
            <span style={{ color:GOLD }}>${cateringTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div style={card()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18 }}>💳 Expenses</div>
          <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({description:"",category:"",amount:""}); }} style={btn("primary")}>+ Add Expense</button>
        </div>
        {showForm && (
          <div style={{ background:"#f9faf8", borderRadius:12, padding:16, marginBottom:16, border:`1px solid ${BORDER}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
              <div><div style={lS}>Description</div><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={iS()} /></div>
              <div><div style={lS}>Category</div>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={iS()}>
                  <option value="">Select…</option>
                  {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><div style={lS}>Amount ($)</div><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={iS()} /></div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={saveExpense} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>{saving?"…":"Save"}</button>
                <button onClick={()=>{setShowForm(false);setEditId(null);}} style={btn("ghost")}>✕</button>
              </div>
            </div>
          </div>
        )}
        {expenses.length===0 && <div style={{ textAlign:"center", padding:30, color:"#9ca3af", fontFamily:FB }}>No expenses yet.</div>}
        {expenses.map(e=>(
          <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${BORDER}`, flexWrap:"wrap", gap:8 }}>
            <div>
              <span style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:14 }}>{e.description}</span>
              {e.category&&<span style={{ marginLeft:8, fontSize:11, color:"#6b7280", background:"#f3f4f6", padding:"2px 8px", borderRadius:8, fontFamily:FB }}>{e.category}</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontFamily:F, fontSize:18, fontWeight:600, color:NAVY }}>${Number(e.amount).toLocaleString()}</span>
              <button onClick={()=>{setForm({description:e.description,category:e.category,amount:e.amount});setEditId(e.id);setShowForm(true);}} style={{ ...btn("ghost",{padding:"4px 10px",fontSize:12}) }}>Edit</button>
              <button onClick={()=>delExpense(e)} style={{ ...btn("danger",{padding:"4px 10px",fontSize:12}) }}>✕</button>
            </div>
          </div>
        ))}
        {expenses.length>0&&(
          <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:12, fontFamily:F, fontSize:20, fontWeight:600, color:NAVY }}>
            Total: <span style={{ color:GOLD, marginLeft:8 }}>${expenseTotal.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDORS TAB
// ─────────────────────────────────────────────────────────────────────────────
function VendorsTab({ vendors, setVendors, api }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyV());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  function emptyV() { return { name:"", category:"", contact:"", phone:"", email:"", status:"researching", notes:"" }; }
  const SC = { researching:{bg:"#eff6ff",color:"#2563eb"}, contacted:{bg:"#fffbeb",color:"#d97706"}, booked:{bg:"#f0fdf4",color:"#16a34a"}, declined:{bg:"#fef2f2",color:"#dc2626"} };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const fields = { Name:form.name, Category:form.category, Contact:form.contact, Phone:form.phone, Email:form.email, Status:form.status, Notes:form.notes };
    try {
      if (editId) {
        const v=vendors.find(x=>x.id===editId);
        if(v?._id) await api.update("Vendors",v._id,fields);
        setVendors(vendors.map(x=>x.id===editId?{...x,...form}:x));
      } else {
        const lid=uid();
        const rec=await api.create("Vendors",{...fields,LID:lid});
        setVendors([...vendors,{...form,_id:rec.id,id:lid}]);
      }
    } catch(e){alert("Error: "+e.message);}
    setSaving(false); setForm(emptyV()); setShowForm(false); setEditId(null);
  };

  const del = async (v) => {
    setVendors(vendors.filter(x=>x.id!==v.id));
    if(v._id){try{await api.del("Vendors",v._id);}catch(e){}}
  };

  // Day-of contact sheet
  const booked = vendors.filter(v=>v.status==="booked");

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:18 }}>
        <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm(emptyV());}} style={btn("primary")}>+ Add Vendor</button>
      </div>

      {showForm && (
        <div style={{ ...card(), border:`2px solid ${GOLD}`, marginBottom:20 }}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18, marginBottom:16 }}>{editId?"Edit Vendor":"New Vendor"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div><div style={lS}>Name *</div><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Category</div><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={iS()} placeholder="e.g. Caterer, DJ…" /></div>
            <div><div style={lS}>Contact Name</div><input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Status</div>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={iS()}>
                <option value="researching">Researching</option>
                <option value="contacted">Contacted</option>
                <option value="booked">Booked ✓</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div><div style={lS}>Phone</div><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Email</div><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={iS()} /></div>
            <div style={{ gridColumn:"span 2" }}><div style={lS}>Notes</div><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{ ...iS(), resize:"vertical" }} /></div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={save} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>{saving?"Saving…":(editId?"Update":"Add")}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null);}} style={btn("ghost")}>Cancel</button>
          </div>
        </div>
      )}

      {/* Day-of contact sheet */}
      {booked.length>0 && (
        <div style={{ ...card({ background:LIGHT_GOLD, border:`1px solid ${GOLD}` }), marginBottom:20 }}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18, marginBottom:12 }}>📋 Day-of Contact Sheet</div>
          {booked.map(v=>(
            <div key={v.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid rgba(201,168,76,.3)`, flexWrap:"wrap", gap:8 }}>
              <div>
                <span style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:14 }}>{v.name}</span>
                {v.category&&<span style={{ marginLeft:8, fontSize:11, color:"#6b5a20", fontFamily:FB }}>{v.category}</span>}
                {v.contact&&<span style={{ marginLeft:8, fontSize:12, color:"#6b7280", fontFamily:FB }}>{v.contact}</span>}
              </div>
              <div style={{ display:"flex", gap:12 }}>
                {v.phone&&<a href={`tel:${v.phone}`} style={{ fontSize:13, color:NAVY, fontFamily:FB, fontWeight:600, textDecoration:"none" }}>📞 {v.phone}</a>}
                {v.email&&<a href={`mailto:${v.email}`} style={{ fontSize:13, color:NAVY, fontFamily:FB, fontWeight:600, textDecoration:"none" }}>✉ {v.email}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {vendors.length===0&&<div style={{ textAlign:"center", padding:40, color:"#9ca3af", fontFamily:FB }}>No vendors yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {vendors.map(v=>{
          const sc=SC[v.status]||SC.researching;
          return (
            <div key={v.id} style={card({ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 })}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                  <span style={{ fontWeight:600, color:NAVY, fontFamily:FB }}>{v.name}</span>
                  {v.category&&<span style={{ fontSize:11, color:"#6b7280", background:"#f3f4f6", padding:"2px 8px", borderRadius:8, fontFamily:FB }}>{v.category}</span>}
                  <span style={{ fontSize:11, padding:"2px 10px", borderRadius:8, background:sc.bg, color:sc.color, fontWeight:600, fontFamily:FB }}>{v.status.charAt(0).toUpperCase()+v.status.slice(1)}</span>
                </div>
                {v.contact&&<div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{v.contact}</div>}
                <div style={{ display:"flex", gap:10, marginTop:2 }}>
                  {v.phone&&<span style={{ fontSize:12, color:"#374151", fontFamily:FB }}>📞 {v.phone}</span>}
                  {v.email&&<span style={{ fontSize:12, color:"#374151", fontFamily:FB }}>✉ {v.email}</span>}
                </div>
                {v.notes&&<div style={{ fontSize:12, color:"#9ca3af", fontFamily:FB, marginTop:3 }}>{v.notes}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignSelf:"flex-start" }}>
                <button onClick={()=>{setForm({...v});setEditId(v.id);setShowForm(true);}} style={btn("ghost",{padding:"5px 12px",fontSize:12})}>Edit</button>
                <button onClick={()=>del(v)} style={btn("danger",{padding:"5px 12px",fontSize:12})}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function GiftsTab({ gifts, setGifts, families, api }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyG());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  function emptyG() { return { giverId:"", description:"", amount:"", thankyou:false, notes:"" }; }

  const giverOpts = families.flatMap(f=>[
    { id:`fam::${f.id}`, label:`${f.name} (family)` },
    ...(f.members||[]).map(m=>({ id:`mem::${f.id}::${m.id}`, label:`${m.name} (${f.name})` }))
  ]);
  const getLabel = id=>giverOpts.find(o=>o.id===id)?.label||id||"—";

  const save = async () => {
    setSaving(true);
    const fields = { GiverID:form.giverId, GiverLabel:getLabel(form.giverId), Description:form.description, Amount:Number(form.amount||0), ThankYou:!!form.thankyou, Notes:form.notes };
    try {
      if (editId) {
        const g=gifts.find(x=>x.id===editId);
        if(g?._id) await api.update("Gifts",g._id,fields);
        setGifts(gifts.map(x=>x.id===editId?{...x,...form,giverLabel:getLabel(form.giverId),amount:Number(form.amount||0)}:x));
      } else {
        const lid=uid();
        const rec=await api.create("Gifts",{...fields,LID:lid});
        setGifts([...gifts,{...form,_id:rec.id,id:lid,giverLabel:getLabel(form.giverId),amount:Number(form.amount||0)}]);
      }
    } catch(e){alert("Error: "+e.message);}
    setSaving(false); setForm(emptyG()); setShowForm(false); setEditId(null);
  };

  const toggleThanks = async (g) => {
    setGifts(gifts.map(x=>x.id===g.id?{...x,thankyou:!x.thankyou}:x));
    if(g._id){try{await api.update("Gifts",g._id,{ThankYou:!g.thankyou});}catch(e){}}
  };

  const del = async (g) => {
    setGifts(gifts.filter(x=>x.id!==g.id));
    if(g._id){try{await api.del("Gifts",g._id);}catch(e){}}
  };

  const total = gifts.reduce((s,g)=>s+Number(g.amount||0),0);
  const done = gifts.filter(g=>g.thankyou).length;

  return (
    <div>
      <div style={{ display:"flex", gap:14, marginBottom:22, flexWrap:"wrap" }}>
        <div style={{ background:`linear-gradient(135deg,${NAVY} 0%,#2a3f6f 100%)`, borderRadius:14, padding:"16px 24px", color:"#fff", flex:1, minWidth:130 }}>
          <div style={{ fontSize:32, fontFamily:F, fontWeight:700, color:GOLD }}>${total.toLocaleString()}</div>
          <div style={{ fontSize:12, opacity:.8, fontFamily:FB }}>Total Gifts Received</div>
        </div>
        <div style={{ ...card(), flex:1, minWidth:130 }}>
          <div style={{ fontSize:32, fontFamily:F, fontWeight:700, color:"#16a34a" }}>{done}/{gifts.length}</div>
          <div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>Thank You Notes Sent</div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:18 }}>
        <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm(emptyG());}} style={btn("primary")}>+ Log Gift</button>
      </div>
      {showForm && (
        <div style={{ ...card(), border:`2px solid ${GOLD}`, marginBottom:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div style={{ gridColumn:"span 2" }}>
              <div style={lS}>From</div>
              <select value={form.giverId} onChange={e=>setForm({...form,giverId:e.target.value})} style={iS()}>
                <option value="">Select who gave the gift…</option>
                {families.map(f=>(
                  <optgroup key={f.id} label={f.name}>
                    <option value={`fam::${f.id}`}>{f.name} (whole family)</option>
                    {(f.members||[]).map(m=><option key={m.id} value={`mem::${f.id}::${m.id}`}>{m.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div><div style={lS}>Amount ($)</div><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={iS()} /></div>
            <div><div style={lS}>Description</div><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={iS()} placeholder="Cheque, voucher, etc." /></div>
            <div style={{ gridColumn:"span 2" }}><div style={lS}>Notes</div><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={iS()} /></div>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontFamily:FB, cursor:"pointer", marginBottom:12 }}>
            <input type="checkbox" checked={form.thankyou} onChange={e=>setForm({...form,thankyou:e.target.checked})} />
            Thank you note already sent
          </label>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={save} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>{saving?"Saving…":(editId?"Update":"Log Gift")}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null);}} style={btn("ghost")}>Cancel</button>
          </div>
        </div>
      )}
      {gifts.length===0&&<div style={{ textAlign:"center", padding:40, color:"#9ca3af", fontFamily:FB }}>No gifts logged yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {gifts.map(g=>(
          <div key={g.id} style={card({ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 })}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                <span style={{ fontWeight:600, color:NAVY, fontFamily:FB }}>{g.giverLabel||"—"}</span>
                {g.amount>0&&<span style={{ fontSize:15, color:GOLD, fontWeight:700, fontFamily:F }}>${Number(g.amount).toLocaleString()}</span>}
                {g.description&&<span style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{g.description}</span>}
              </div>
              {g.notes&&<div style={{ fontSize:12, color:"#9ca3af", fontFamily:FB }}>{g.notes}</div>}
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontFamily:FB, cursor:"pointer", color:g.thankyou?"#16a34a":"#9ca3af", marginTop:6 }}>
                <input type="checkbox" checked={!!g.thankyou} onChange={()=>toggleThanks(g)} />
                {g.thankyou?"✓ Thank you sent":"Thank you pending"}
              </label>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{setForm({giverId:g.giverId,description:g.description,amount:g.amount,thankyou:g.thankyou,notes:g.notes});setEditId(g.id);setShowForm(true);}} style={btn("ghost",{padding:"5px 12px",fontSize:12})}>Edit</button>
              <button onClick={()=>del(g)} style={btn("danger",{padding:"5px 12px",fontSize:12})}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN OF SHOW TAB
// ─────────────────────────────────────────────────────────────────────────────
function RunOfShowTab({ runOfShow, setRunOfShow, api }) {
  const [activeEvent, setActiveEvent] = useState("friday");
  const [form, setForm] = useState({ time:"", item:"", notes:"" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const items = runOfShow.filter(r=>r.eventId===activeEvent).sort((a,b)=>a.order-b.order);

  const add = async () => {
    if (!form.item.trim()) return;
    setSaving(true);
    const lid=uid();
    const order=items.length;
    try {
      const rec=await api.create("RunOfShow",{LID:lid,EventID:activeEvent,Time:form.time,Item:form.item,Notes:form.notes,Order:order});
      setRunOfShow([...runOfShow,{_id:rec.id,id:lid,eventId:activeEvent,time:form.time,item:form.item,notes:form.notes,order}]);
      setForm({time:"",item:"",notes:""});
    } catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };

  const del = async (r) => {
    setRunOfShow(runOfShow.filter(x=>x.id!==r.id));
    if(r._id){try{await api.del("RunOfShow",r._id);}catch(e){}}
  };

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {EVENTS.map(ev=>(
          <button key={ev.id} onClick={()=>setActiveEvent(ev.id)} style={{
            padding:"8px 16px", borderRadius:10, border:`1px solid ${BORDER}`,
            background:activeEvent===ev.id?NAVY:"#fff",
            color:activeEvent===ev.id?"#fff":NAVY,
            fontFamily:FB, fontSize:13, fontWeight:600, cursor:"pointer"
          }}>{ev.icon} {ev.name}</button>
        ))}
      </div>

      <div style={{ ...card(), marginBottom:16 }}>
        <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:18, marginBottom:14 }}>
          {EVENTS.find(e=>e.id===activeEvent)?.icon} {EVENTS.find(e=>e.id===activeEvent)?.name} — Schedule
        </div>
        {items.length===0&&<div style={{ color:"#9ca3af", fontFamily:FB, fontSize:13, marginBottom:14 }}>No schedule items yet.</div>}
        {items.map((r,i)=>(
          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ width:60, fontFamily:F, fontWeight:600, color:GOLD, fontSize:15, flexShrink:0 }}>{r.time||"—"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:14 }}>{r.item}</div>
              {r.notes&&<div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{r.notes}</div>}
            </div>
            <button onClick={()=>del(r)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:16, opacity:.6 }}>×</button>
          </div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr auto", gap:8, marginTop:14 }}>
          <input placeholder="Time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} style={iS()} />
          <input placeholder="Schedule item *" value={form.item} onChange={e=>setForm({...form,item:e.target.value})} onKeyDown={e=>e.key==="Enter"&&add()} style={iS()} />
          <input placeholder="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={iS()} />
          <button onClick={add} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BAR MITZVAH TAB
// ─────────────────────────────────────────────────────────────────────────────
function BarMitzvahTab({ aliyot, setAliyot, torah, setTorah, api }) {
  const [showAliyahForm, setShowAliyahForm] = useState(false);
  const [aliyahForm, setAliyahForm] = useState(emptyA());
  const [editAliyahId, setEditAliyahId] = useState(null);
  const [saving, setSaving] = useState(false);

  function emptyA() { return { name:"", aliyahName:"", relationship:"", section:"", notes:"", order: aliyot.length+1 }; }

  const torahFields = [
    { key:"parshaName", label:"Parsha Name" },
    { key:"torahDate", label:"Torah Portion Date" },
    { key:"tutorName", label:"Tutor Name" },
    { key:"tutorPhone", label:"Tutor Phone" },
    { key:"tutorEmail", label:"Tutor Email" },
    { key:"synagogueName", label:"Synagogue" },
    { key:"rabbsName", label:"Rabbi's Name" },
    { key:"cantorName", label:"Cantor's Name" },
    { key:"notes", label:"General Notes" },
  ];

  const updateTorah = async (key, value) => {
    const existing = torah[key];
    setTorah({ ...torah, [key]: { ...(existing||{}), value } });
    try {
      if (existing?._id) await api.update("TorahInfo", existing._id, { Key:key, Value:value });
      else { const rec=await api.create("TorahInfo",{Key:key,Value:value}); setTorah(prev=>({...prev,[key]:{_id:rec.id,value}})); }
    } catch(e){console.error(e);}
  };

  const saveAliyah = async () => {
    if (!aliyahForm.name.trim()) return;
    setSaving(true);
    const fields = { Name:aliyahForm.name, AliyahName:aliyahForm.aliyahName, Relationship:aliyahForm.relationship, Section:aliyahForm.section, Notes:aliyahForm.notes, Order:Number(aliyahForm.order||0) };
    try {
      if (editAliyahId) {
        const a=aliyot.find(x=>x.id===editAliyahId);
        if(a?._id) await api.update("Aliyot",a._id,fields);
        setAliyot(aliyot.map(x=>x.id===editAliyahId?{...x,...aliyahForm}:x).sort((a,b)=>a.order-b.order));
      } else {
        const lid=uid();
        const rec=await api.create("Aliyot",{...fields,LID:lid});
        setAliyot([...aliyot,{...aliyahForm,_id:rec.id,id:lid}].sort((a,b)=>Number(a.order)-Number(b.order)));
      }
    } catch(e){alert("Error: "+e.message);}
    setSaving(false); setAliyahForm(emptyA()); setShowAliyahForm(false); setEditAliyahId(null);
  };

  const delAliyah = async (a) => {
    setAliyot(aliyot.filter(x=>x.id!==a.id));
    if(a._id){try{await api.del("Aliyot",a._id);}catch(e){}}
  };

  return (
    <div>
      {/* Torah info */}
      <div style={{ ...card(), marginBottom:20 }}>
        <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:20, marginBottom:18 }}>📜 Torah & Ceremony Details</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {torahFields.map(({key,label})=>(
            <div key={key} style={key==="notes"?{gridColumn:"span 2"}:{}}>
              <div style={lS}>{label}</div>
              {key==="notes"
                ? <textarea value={torah[key]?.value||""} onChange={e=>updateTorah(key,e.target.value)} rows={3} style={{ ...iS(), resize:"vertical" }} />
                : <input value={torah[key]?.value||""} onChange={e=>updateTorah(key,e.target.value)} style={iS()} />
              }
            </div>
          ))}
        </div>
      </div>

      {/* Aliyot */}
      <div style={card()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:F, fontWeight:600, color:NAVY, fontSize:20 }}>🕍 Aliyot Planner</div>
          <button onClick={()=>{setAliyahForm(emptyA());setEditAliyahId(null);setShowAliyahForm(true);}} style={btn("primary")}>+ Add Aliyah</button>
        </div>

        {showAliyahForm && (
          <div style={{ background:"#f9faf8", borderRadius:12, padding:16, marginBottom:16, border:`1px solid ${BORDER}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><div style={lS}>Person's Name *</div><input value={aliyahForm.name} onChange={e=>setAliyahForm({...aliyahForm,name:e.target.value})} style={iS()} /></div>
              <div><div style={lS}>Aliyah (e.g. Rishon, Sheni)</div><input value={aliyahForm.aliyahName} onChange={e=>setAliyahForm({...aliyahForm,aliyahName:e.target.value})} style={iS()} /></div>
              <div><div style={lS}>Relationship to Bar Mitzvah boy</div><input value={aliyahForm.relationship} onChange={e=>setAliyahForm({...aliyahForm,relationship:e.target.value})} style={iS()} /></div>
              <div><div style={lS}>Order</div><input type="number" value={aliyahForm.order} onChange={e=>setAliyahForm({...aliyahForm,order:e.target.value})} style={iS()} /></div>
              <div><div style={lS}>Torah Section</div><input value={aliyahForm.section} onChange={e=>setAliyahForm({...aliyahForm,section:e.target.value})} style={iS()} placeholder="e.g. Verses 5:1-10" /></div>
              <div><div style={lS}>Notes</div><input value={aliyahForm.notes} onChange={e=>setAliyahForm({...aliyahForm,notes:e.target.value})} style={iS()} /></div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={saveAliyah} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>{saving?"Saving…":(editAliyahId?"Update":"Add Aliyah")}</button>
              <button onClick={()=>{setShowAliyahForm(false);setEditAliyahId(null);}} style={btn("ghost")}>Cancel</button>
            </div>
          </div>
        )}

        {aliyot.length===0&&<div style={{ color:"#9ca3af", fontFamily:FB, fontSize:13 }}>No aliyot planned yet.</div>}
        {aliyot.map((a,i)=>(
          <div key={a.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${NAVY},#2a3f6f)`, display:"flex", alignItems:"center", justifyContent:"center", color:GOLD, fontFamily:F, fontWeight:700, fontSize:15, flexShrink:0 }}>{a.order}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <span style={{ fontFamily:FB, fontWeight:600, color:NAVY, fontSize:14 }}>{a.name}</span>
                {a.aliyahName&&<span style={{ fontSize:12, background:LIGHT_GOLD, color:"#6b5a20", padding:"2px 8px", borderRadius:8, fontFamily:FB, fontWeight:600 }}>{a.aliyahName}</span>}
                {a.relationship&&<span style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{a.relationship}</span>}
              </div>
              {a.section&&<div style={{ fontSize:12, color:"#9ca3af", fontFamily:FB, marginTop:2 }}>Section: {a.section}</div>}
              {a.notes&&<div style={{ fontSize:12, color:"#6b7280", fontFamily:FB }}>{a.notes}</div>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{setAliyahForm({...a});setEditAliyahId(a.id);setShowAliyahForm(true);}} style={btn("ghost",{padding:"4px 10px",fontSize:12})}>Edit</button>
              <button onClick={()=>delAliyah(a)} style={btn("danger",{padding:"4px 10px",fontSize:12})}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE TAB
// ─────────────────────────────────────────────────────────────────────────────
function TimelineTab({ tasks, setTasks, api }) {
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!newTask.trim()) return;
    setSaving(true);
    const lid=uid();
    const order=tasks.length;
    try {
      const rec=await api.create("Tasks",{LID:lid,Task:newTask,Due:newDue,Done:false,Order:order});
      setTasks([...tasks,{_id:rec.id,id:lid,task:newTask,due:newDue,done:false,order}]);
      setNewTask(""); setNewDue("");
    } catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };

  const toggle = async (t) => {
    setTasks(tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x));
    if(t._id){try{await api.update("Tasks",t._id,{Done:!t.done});}catch(e){}}
  };

  const del = async (t) => {
    setTasks(tasks.filter(x=>x.id!==t.id));
    if(t._id){try{await api.del("Tasks",t._id);}catch(e){}}
  };

  const pending = tasks.filter(t=>!t.done);
  const done = tasks.filter(t=>t.done);
  const pct = tasks.length>0?Math.round(done.length/tasks.length*100):0;

  return (
    <div>
      <div style={{ ...card({ background:`linear-gradient(135deg,${NAVY} 0%,#2a3f6f 100%)`, color:"#fff" }), marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontFamily:F, fontSize:22, fontWeight:600 }}>Planning Progress</div>
          <div style={{ fontFamily:F, fontSize:32, fontWeight:700, color:GOLD }}>{pct}%</div>
        </div>
        <div style={{ background:"rgba(255,255,255,.15)", borderRadius:8, height:8, overflow:"hidden" }}>
          <div style={{ background:GOLD, height:"100%", width:`${pct}%`, borderRadius:8, transition:"width .4s" }} />
        </div>
        <div style={{ display:"flex", gap:20, marginTop:8, fontFamily:FB, fontSize:13, opacity:.75 }}>
          <span>{done.length} complete</span>
          <span>{pending.length} remaining</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <input placeholder="New task…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} style={{ ...iS(), flex:1, minWidth:200 }} />
        <input placeholder="Due (e.g. Mar 2026)" value={newDue} onChange={e=>setNewDue(e.target.value)} style={{ ...iS(), width:160 }} />
        <button onClick={add} disabled={saving} style={{ ...btn("primary"), opacity:saving?.7:1 }}>Add Task</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[...pending,...done].map(t=>(
          <div key={t.id} style={{ background:t.done?"#f9faf8":"#fff", border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, opacity:t.done?.65:1, transition:"opacity .2s" }}>
            <input type="checkbox" checked={!!t.done} onChange={()=>toggle(t)} style={{ width:17, height:17, cursor:"pointer", accentColor:NAVY }} />
            <div style={{ flex:1 }}>
              <span style={{ fontWeight:500, color:NAVY, textDecoration:t.done?"line-through":"none", fontSize:14, fontFamily:FB }}>{t.task}</span>
              {t.due&&<span style={{ marginLeft:10, fontSize:11, color:GOLD, fontWeight:600, fontFamily:FB }}>{t.due}</span>}
            </div>
            <button onClick={()=>del(t)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:16, opacity:.5 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false);
  const [api, setApi] = useState(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const [families, setFamilies] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cateringPrices, setCateringPrices] = useState({});
  const [vendors, setVendors] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [runOfShow, setRunOfShow] = useState([]);
  const [aliyot, setAliyot] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [torah, setTorah] = useState({});

  useEffect(() => {
    const token = localStorage.getItem("bm_token");
    const baseId = localStorage.getItem("bm_baseId");
    if (token && baseId) handleConnect(token, baseId);
  }, []);

  const handleConnect = async (token, baseId) => {
    const a = new AT(token, baseId);
    setApi(a);
    setLoading(true);
    try {
      const data = await loadAll(a);
      setFamilies(data.families); setExpenses(data.expenses);
      setCateringPrices(data.cateringPrices); setVendors(data.vendors);
      setGifts(data.gifts); setRunOfShow(data.runOfShow);
      setAliyot(data.aliyot); setTasks(data.tasks);
      setHotels(data.hotels); setTorah(data.torah);
      setConnected(true);
    } catch(e) {
      alert("Error loading data: "+e.message);
      localStorage.removeItem("bm_token"); localStorage.removeItem("bm_baseId");
    }
    setLoading(false);
  };

  if (!connected) return <SetupScreen onConnect={handleConnect} />;
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F, color:NAVY, fontSize:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      Loading your planner…
    </div>
  );

  const pages = [
    <Dashboard families={families} expenses={expenses} cateringPrices={cateringPrices} tasks={tasks} gifts={gifts} />,
    <FamiliesTab families={families} setFamilies={setFamilies} api={api} />,
    <SeatingTab families={families} />,
    <CostsTab families={families} expenses={expenses} setExpenses={setExpenses} cateringPrices={cateringPrices} setCateringPrices={setCateringPrices} api={api} />,
    <VendorsTab vendors={vendors} setVendors={setVendors} api={api} />,
    <GiftsTab gifts={gifts} setGifts={setGifts} families={families} api={api} />,
    <RunOfShowTab runOfShow={runOfShow} setRunOfShow={setRunOfShow} api={api} />,
    <BarMitzvahTab aliyot={aliyot} setAliyot={setAliyot} torah={torah} setTorah={setTorah} api={api} />,
    <TimelineTab tasks={tasks} setTasks={setTasks} api={api} />,
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", fontFamily:FB }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${NAVY} 0%,#243460 100%)`, padding:"24px 32px" }}>
        <div style={{ maxWidth:980, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <span style={{ fontSize:28 }}>✡️</span>
            <div>
              <h1 style={{ margin:0, fontFamily:F, fontSize:24, fontWeight:600, color:"#fff", letterSpacing:.5 }}>Bar Mitzvah Planner</h1>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.55)", marginTop:2, letterSpacing:1, textTransform:"uppercase", fontFamily:FB }}>November 6, 2027</div>
            </div>
          </div>
          <button onClick={()=>{localStorage.removeItem("bm_token");localStorage.removeItem("bm_baseId");setConnected(false);}}
            style={{ ...btn("ghost",{fontSize:12,padding:"6px 14px"}), color:"rgba(255,255,255,.6)", border:"1px solid rgba(255,255,255,.2)", background:"transparent" }}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${BORDER}`, overflowX:"auto" }}>
        <div style={{ maxWidth:980, margin:"0 auto", display:"flex" }}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)} style={{
              padding:"12px 16px", border:"none", borderBottom:tab===i?`3px solid ${GOLD}`:"3px solid transparent",
              background:"none", cursor:"pointer", fontFamily:FB, fontSize:13,
              fontWeight:tab===i?600:400, color:tab===i?NAVY:"#6b7280", whiteSpace:"nowrap", transition:"all .15s"
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:980, margin:"0 auto", padding:"28px 18px" }}>
        {pages[tab]}
      </div>
    </div>
  );
}
