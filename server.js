const express = require("express");
const app = express();
const db = require("./db");

app.use(express.json());
app.use(express.static("public"));

/* =========================
   플레이어
========================= */
app.get("/api/players", (req, res) => {
  db.all("SELECT * FROM players ORDER BY name", [], (e, rows) => {
    if (e) return res.status(500).json(e);
    res.json(rows);
  });
});

app.post("/api/player", (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.json({ error: "EMPTY_NAME" });

  db.get(
    "SELECT id FROM players WHERE LOWER(name) = LOWER(?)",
    [name],
    (e, row) => {
      if (row) return res.json({ error: "DUPLICATE" });

      db.run(
        "INSERT INTO players(name) VALUES (?)",
        [name],
        function () {
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.delete("/api/player/:id", (req, res) => {
  db.run("DELETE FROM players WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

/* =========================
   경기 저장
========================= */
app.post("/api/match", (req, res) => {
  const { winner, created_at, map_name, ban_a, ban_b, entries } = req.body;

  db.run(
    `
    INSERT INTO matches (winner, created_at, map_name, ban_a, ban_b)
    VALUES (?, ?, ?, ?, ?)
    `,
    [winner, created_at, map_name, ban_a, ban_b],
    function () {
      const matchId = this.lastID;

      entries.forEach(e => {
        db.run(
          `
          INSERT INTO match_players
          (match_id, player_id, team, role, result)
          VALUES (?, ?, ?, ?, ?)
          `,
          [matchId, e.playerId, e.team, e.role, e.result]
        );
      });

      res.json({ success: true });
    }
  );
});

/* =========================
   통계
========================= */
app.get("/api/stats", (req, res) => {
  const date = req.query.date;

  const where = date ? "AND m.created_at = ?" : "";
  const params = date ? [date] : [];

  const sql = `
    SELECT
      p.id,
      p.name,
      COUNT(mp.id) AS games,

      SUM(mp.role='Tank' AND mp.result='W') AS tank_w,
      SUM(mp.role='Tank' AND mp.result='L') AS tank_l,

      SUM(mp.role='DPS' AND mp.result='W') AS dps_w,
      SUM(mp.role='DPS' AND mp.result='L') AS dps_l,

      SUM(mp.role='Healer' AND mp.result='W') AS heal_w,
      SUM(mp.role='Healer' AND mp.result='L') AS heal_l,

      SUM(mp.result='W') AS wins,
      SUM(mp.result='L') AS losses

    FROM players p
    JOIN match_players mp ON p.id = mp.player_id
    JOIN matches m ON mp.match_id = m.id
    WHERE 1=1 ${where}
    GROUP BY p.id
    ORDER BY games DESC
  `;

  db.all(sql, params, (e, rows) => {
    if (e) return res.status(500).json(e);
    res.json(rows);
  });
});

/* =========================
   날짜 목록
========================= */
app.get("/api/match-dates", (req, res) => {
  db.all(
    `SELECT DISTINCT created_at AS match_date FROM matches ORDER BY created_at DESC`,
    [],
    (e, rows) => res.json(rows)
  );
});

/* =========================
   선수 상세 (날짜 필터 정확)
========================= */
app.get("/api/player/:id/matches", (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  const sql = `
    SELECT
      m.created_at,
      mp.team,
      mp.role,
      mp.result
    FROM match_players mp
    JOIN matches m ON mp.match_id = m.id
    WHERE mp.player_id = ?
    ${date ? "AND m.created_at = ?" : ""}
    ORDER BY m.created_at ASC
  `;

  const params = date ? [id, date] : [id];

  db.all(sql, params, (e, rows) => {
    if (e) return res.status(500).json(e);
    res.json(rows);
  });
});

/* =========================
   관리자: 경기 목록
========================= */
app.get("/api/admin/matches", (req, res) => {
  db.all(
    `SELECT * FROM matches ORDER BY created_at DESC`,
    [],
    (e, rows) => res.json(rows)
  );
});

/* =========================
   관리자: 경기 상세 (수정용)
========================= */
app.get("/api/admin/match/:id", (req, res) => {
  const id = req.params.id;

  db.get(
    `SELECT * FROM matches WHERE id = ?`,
    [id],
    (e, match) => {
      db.all(
        `SELECT * FROM match_players WHERE match_id = ?`,
        [id],
        (e2, players) => {
          res.json({ match, players });
        }
      );
    }
  );
});

/* =========================
   관리자: 경기 전체 수정
========================= */
app.put("/api/admin/match/:id", (req, res) => {
  const { created_at, map_name, ban_a, ban_b, winner, players } = req.body;
  const id = req.params.id;

  db.run(
    `
    UPDATE matches
    SET created_at=?, map_name=?, ban_a=?, ban_b=?, winner=?
    WHERE id=?
    `,
    [created_at, map_name, ban_a, ban_b, winner, id],
    () => {
      db.run(`DELETE FROM match_players WHERE match_id=?`, [id], () => {
        players.forEach(p => {
          db.run(
            `
            INSERT INTO match_players
            (match_id, player_id, team, role, result)
            VALUES (?, ?, ?, ?, ?)
            `,
            [id, p.player_id, p.team, p.role, p.result]
          );
        });

        res.json({ success: true });
      });
    }
  );
});

/* ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
