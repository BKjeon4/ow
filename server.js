import express from "express";
import { createClient } from "@supabase/supabase-js";

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
   경기 저장
========================= */
app.post("/api/match", async (req, res) => {
  const { winner, created_at, map_name, ban_a, ban_b, entries } = req.body;

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      winner,
      created_at,
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
  res.json({ success: true });
});

/* =========================
   통계
========================= */
app.get("/api/stats", async (req, res) => {
  const date = req.query.date;

  let query = supabase
    .from("match_players")
    .select(`
      result,
      role,
      team,
      players(id, name),
      matches(created_at)
    `);

  if (date) {
    query = query.eq("matches.created_at", date);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json(error);

  const stats = {};

  data.forEach(r => {
    const p = r.players;
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

  const dates = [...new Set(data.map(d => d.created_at))];
  res.json(dates.map(d => ({ match_date: d })));
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
      team,
      role,
      result,
      matches(created_at)
    `)
    .eq("player_id", id);

  if (date) {
    query = query.eq("matches.created_at", date);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json(error);

  res.json(data.map(r => ({
    team: r.team,
    role: r.role,
    result: r.result,
    created_at: r.matches.created_at
  })));
});

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
   관리자: 경기 수정
========================= */
app.put("/api/admin/match/:id", async (req, res) => {
  const { id } = req.params;
  const { created_at, map_name, ban_a, ban_b, winner, players } = req.body;

  await supabase
    .from("matches")
    .update({ created_at, map_name, ban_a, ban_b, winner })
    .eq("id", id);

  await supabase.from("match_players").delete().eq("match_id", id);

  const rows = players.map(p => ({
    match_id: id,
    player_id: p.player_id,
    team: p.team,
    role: p.role,
    result: p.result
  }));

  await supabase.from("match_players").insert(rows);

  res.json({ success: true });
});

/* ========================= */
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log("🚀 Server running on", PORT);
// });
