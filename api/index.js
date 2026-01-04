import express from "express";
import "dotenv/config"
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from 'bcryptjs'; // npm install bcryptjs 필요 


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(express.json());
app.use(express.static("public"));

/* =========================
   Supabase Client
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   플레이어
========================= */
app.get("/api/players", async (req, res) => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("name");

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post("/api/player", async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.json({ error: "EMPTY_NAME" });

  const { data: exists } = await supabase
    .from("players")
    .select("id")
    .ilike("name", name);

  if (exists.length > 0) {
    return res.json({ error: "DUPLICATE" });
  }

  const { error } = await supabase
    .from("players")
    .insert({ name });

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.delete("/api/player/:id", async (req, res) => {
  await supabase.from("players").delete().eq("id", req.params.id);
  res.json({ success: true });
});

/* =========================
   경기 저장 (로그 추가) - 토론토 시간대 처리
========================= */
app.post("/api/match", async (req, res) => {
  const { winner, created_at, map_name, ban_a, ban_b, entries, admin_id, admin_name } = req.body;

  // 토론토 시간 → UTC 변환
  let finalDateTime = created_at;
  if (!created_at.endsWith('Z')) {
    // 로컬 시간으로 들어온 경우 토론토 시간으로 간주
    const torontoDate = new Date(created_at);
    // 토론토는 UTC-5 (EST) 또는 UTC-4 (EDT)
    // JavaScript Date는 자동으로 로컬 시간대를 인식하므로 toISOString()만 호출
    finalDateTime = new Date(created_at + (created_at.length === 16 ? ':00' : '')).toISOString();
  }

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      winner,
      created_at: finalDateTime,
      map_name,
      ban_a,
      ban_b
    })
    .select()
    .single();

  if (error) return res.status(500).json(error);

  const rows = entries.map(e => ({
    match_id: match.id,
    player_id: e.playerId,
    team: e.team,
    role: e.role,
    result: e.result
  }));

  await supabase.from("match_players").insert(rows);
  
  // 로그 기록
  if (admin_id) {
    await supabase.from("admin_logs").insert({
      admin_id,
      action: `경기 추가: ${map_name} (${winner} 승리) - ${admin_name}`
    });
  }

  res.json({ success: true });
});
/* =========================
   통계
========================= */
app.get("/api/stats", async (req, res) => {
  const date = req.query.date;

  // 날짜로 match_id 필터링
  let matchIds = null;
  
  if (date) {
    const startTime = `${date}T00:00:00.000Z`;
    const endTime = `${date}T23:59:59.999Z`;
    
    const { data: matches, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .gte("created_at", startTime)
      .lte("created_at", endTime);
    
    if (matchError) return res.status(500).json(matchError);
    
    matchIds = matches.map(m => m.id);
    
    if (matchIds.length === 0) {
      return res.json([]);
    }
  }

  // match_players 조회
  let query = supabase
    .from("match_players")
    .select(`
      result,
      role,
      team,
      match_id,
      players(id, name)
    `);

  if (matchIds) {
    query = query.in("match_id", matchIds);
  }

  const { data, error } = await query;
  
  if (error) return res.status(500).json(error);

  const stats = {};

  data.forEach(r => {
    const p = r.players;
    if (!p || !p.id) return;
    
    if (!stats[p.id]) {
      stats[p.id] = {
        id: p.id,
        name: p.name,
        games: 0,
        tank_w: 0, tank_l: 0,
        dps_w: 0, dps_l: 0,
        heal_w: 0, heal_l: 0,
        wins: 0,
        losses: 0
      };
    }

    stats[p.id].games++;
    if (r.result === "W") stats[p.id].wins++;
    else stats[p.id].losses++;

    if (r.role === "Tank") r.result === "W" ? stats[p.id].tank_w++ : stats[p.id].tank_l++;
    if (r.role === "DPS") r.result === "W" ? stats[p.id].dps_w++ : stats[p.id].dps_l++;
    if (r.role === "Healer") r.result === "W" ? stats[p.id].heal_w++ : stats[p.id].heal_l++;
  });

  res.json(Object.values(stats));
});


/* =========================
   날짜 목록
========================= */
app.get("/api/match-dates", async (req, res) => {
  const { data, error } = await supabase
    .from("matches")
    .select("created_at")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  const dates = [...new Set(
  data.map(d => d.created_at.slice(0, 10))
)];

res.json(dates.map(d => ({ match_date: d })));

});

/* =========================
   날짜별 경기 목록
========================= */
app.get("/api/matches/by-date/:date", async (req, res) => {
  const date = req.params.date;

  const start = `${date}T00:00:00.000Z`;
  const end   = `${date}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("match_players")
    .select(`
      team,
      role,
      result,
      players!inner ( name ),
      matches!inner ( created_at )
    `)
    .gte("matches.created_at", start)
    .lte("matches.created_at", end);

  if (error) {
    console.error("❌ by-date error:", error);
    return res.status(500).json(error);
  }

  // 🔥 null 방어 + 프론트용 변환
  const rows = data.map(r => ({
    created_at: r.matches.created_at.slice(0, 10),
    name: r.players.name,
    team: r.team,
    role: r.role,
    result: r.result
  }));

  res.json(rows);
});


/* =========================
   선수 상세 (날짜 필터)
========================= */
app.get("/api/player/:id/matches", async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  let query = supabase
    .from("match_players")
    .select(`
      role,
      team,
      result,
      matches!inner ( created_at )
    `)
    .eq("player_id", id);

if (date) {
  query = query
    .gte("matches.created_at", `${date}T00:00:00.000Z`)
    .lte("matches.created_at", `${date}T23:59:59.999Z`);
}

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return res.status(500).json(error);
  }

  const rows = data.map(r => ({
    created_at: r.matches.created_at,
    team: r.team,
    role: r.role,
    result: r.result
  }));

  res.json(rows);
});

//관리자 시작 

//ABOUT 관리자 itself

/* =========================
   관리자 로그인
========================= */
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  const { data: admin, error } = await supabase
    .from("admins")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !admin) {
    return res.json({ success: false, message: "아이디 또는 비밀번호가 잘못되었습니다" });
  }

  // 비밀번호 확인
  const isValid = await bcrypt.compare(password, admin.password);
  
  if (!isValid) {
    return res.json({ success: false, message: "아이디 또는 비밀번호가 잘못되었습니다" });
  }

  res.json({ 
    success: true, 
    admin: { 
      id: admin.id, 
      username: admin.username, 
      name: admin.name 
    } 
  });
});

/* =========================
   관리자 목록 조회
========================= */
app.get("/api/admins", async (req, res) => {
  const { data, error } = await supabase
    .from("admins")
    .select("id, username, name, created_at")
    .order("created_at");

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* =========================
   관리자 추가
========================= */
app.post("/api/admin/create", async (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    return res.json({ error: "모든 필드를 입력해주세요" });
  }

  // 중복 체크
  const { data: exists } = await supabase
    .from("admins")
    .select("id")
    .eq("username", username);

  if (exists && exists.length > 0) {
    return res.json({ error: "이미 존재하는 아이디입니다" });
  }

  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from("admins")
    .insert({ username, password: hashedPassword, name });

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

/* =========================
   관리자 삭제
========================= */
app.delete("/api/admin/:id", async (req, res) => {
  const { id } = req.params;

  // 마지막 관리자 체크
  const { data: admins } = await supabase
    .from("admins")
    .select("id");

  if (admins.length <= 1) {
    return res.json({ error: "최소 1명의 관리자가 필요합니다" });
  }

  await supabase.from("admins").delete().eq("id", id);
  res.json({ success: true });
});

/* =========================
   로그 기록
========================= */
app.post("/api/admin/log", async (req, res) => {
  const { admin_id, action } = req.body;

  const { error } = await supabase
    .from("admin_logs")
    .insert({ admin_id, action });

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

/* =========================
   로그 조회
========================= */
app.get("/api/admin/logs", async (req, res) => {
  const { data, error } = await supabase
    .from("admin_logs")
    .select(`
      id,
      action,
      created_at,
      admins (username, name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json(error);
  res.json(data);
});


//관리자 경기 관리

/* =========================
   관리자: 경기 목록
========================= */
app.get("/api/admin/matches", async (req, res) => {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});




/* =========================
   관리자: 경기 상세 조회 (수정용)
========================= */
app.get("/api/admin/match/:id", async (req, res) => {
  const { id } = req.params;

  // 경기 정보
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (matchError) {
    console.error("경기 조회 실패:", matchError);
    return res.status(500).json(matchError);
  }

  // 참가 선수 정보
  const { data: players, error: playersError } = await supabase
    .from("match_players")
    .select("player_id, team, role, result")
    .eq("match_id", id);

  if (playersError) {
    console.error("선수 조회 실패:", playersError);
    return res.status(500).json(playersError);
  }

  res.json({ match, players });
});

/* =========================
   경기 수정 (로그 추가) - 토론토 시간대 처리
========================= */
app.put("/api/admin/match-full/:id", async (req, res) => {
  const { id } = req.params;
  const { winner, created_at, map_name, ban_a, ban_b, entries, admin_id, admin_name } = req.body;

  // 토론토 시간 → UTC 변환
  let finalDateTime = created_at;
  if (!created_at.endsWith('Z')) {
    finalDateTime = new Date(created_at + (created_at.length === 16 ? ':00' : '')).toISOString();
  }

  const { error: matchError } = await supabase
    .from("matches")
    .update({
      winner,
      created_at: finalDateTime,
      map_name,
      ban_a,
      ban_b
    })
    .eq("id", id);

  if (matchError) return res.status(500).json(matchError);

  await supabase.from("match_players").delete().eq("match_id", id);

  const rows = entries.map(e => ({
    match_id: Number(id),
    player_id: e.playerId,
    team: e.team,
    role: e.role,
    result: e.result
  }));

  await supabase.from("match_players").insert(rows);

  // 로그 기록
  if (admin_id) {
    await supabase.from("admin_logs").insert({
      admin_id,
      action: `경기 수정: ID ${id} (${map_name}) - ${admin_name}`
    });
  }

  res.json({ success: true });
});

/* =========================
   경기 삭제 (로그 추가)
========================= */
app.delete("/api/admin/match/:id", async (req, res) => {
  const { id } = req.params;
  const { admin_id, admin_name } = req.query;

  // 경기 정보 먼저 조회 (로그용)
  const { data: match } = await supabase
    .from("matches")
    .select("map_name, winner")
    .eq("id", id)
    .single();

  await supabase.from("match_players").delete().eq("match_id", id);
  await supabase.from("matches").delete().eq("id", id);

  // 로그 기록
  if (admin_id && match) {
    await supabase.from("admin_logs").insert({
      admin_id,
      action: `경기 삭제: ID ${id} (${match.map_name}) - ${admin_name}`
    });
  }

  res.json({ success: true });
});



//완전 중요
//local
// const PORT = process.env.PORT || 3000;
//  app.listen(PORT, () => {
//  console.log("🚀 Server running on", PORT);
//  });


// // vercel
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
export default app;