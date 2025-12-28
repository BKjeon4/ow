const express = require("express");
const app = express();
const db = require("./db");

app.use(express.json());
app.use(express.static("public"));

/* =========================
   플레이어 조회
========================= */
app.get("/api/players", (req, res) => {
  db.all(
    "SELECT * FROM players ORDER BY name",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

/* =========================
   플레이어 추가 (중복 검사)
========================= */
app.post("/api/player", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "EMPTY_NAME" });
  }

  const normalized = name.trim().toLowerCase();

  // 대소문자 무시 중복 체크
  db.get(
    "SELECT id FROM players WHERE LOWER(name) = ?",
    [normalized],
    (err, row) => {
      if (row) {
        return res.json({ error: "DUPLICATE" });
      }

      db.run(
        "INSERT INTO players(name) VALUES (?)",
        [name.trim()],
        function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

/* =========================
   플레이어 삭제
========================= */
app.delete("/api/player/:id", (req, res) => {
  const id = req.params.id;

  db.run(
    "DELETE FROM players WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

/* =========================
   경기 저장
========================= */
app.post("/api/match", (req, res) => {
  const { winner, entries, created_at, map_name, ban_a, ban_b } = req.body;

  const sql = created_at
    ? `INSERT INTO matches (winner, created_at, map_name, ban_a, ban_b)
       VALUES (?, ?, ?, ?, ?)`
    : `INSERT INTO matches (winner, map_name, ban_a, ban_b)
       VALUES (?, ?, ?, ?)`;

  const params = created_at
    ? [winner, created_at, map_name, ban_a, ban_b]
    : [winner, map_name, ban_a, ban_b];

  db.run(sql, params, function () {
    const matchId = this.lastID;
    entries.forEach(e => {
      db.run(
        `INSERT INTO match_players (match_id, player_id, team, role, result)
         VALUES (?, ?, ?, ?, ?)`,
        [matchId, e.playerId, e.team, e.role, e.result]
      );
    });
    res.json({ success: true });
  });
});



/* =========================
   통계 조회 (대시보드)
========================= */
app.get("/api/stats", (req, res) => {
  const { date } = req.query;

  const dateCondition = date ? `AND DATE(m.created_at) = ?` : ``;
  const params = date ? [date] : [];

  const sql = `
    SELECT
      p.id,
      p.name,
      COUNT(mp.id) AS games,

      -- Tank
      SUM(CASE WHEN mp.role = 'Tank' AND mp.result = 'W' THEN 1 ELSE 0 END) AS tank_w,
      SUM(CASE WHEN mp.role = 'Tank' AND mp.result = 'L' THEN 1 ELSE 0 END) AS tank_l,

      -- DPS
      SUM(CASE WHEN mp.role = 'DPS' AND mp.result = 'W' THEN 1 ELSE 0 END) AS dps_w,
      SUM(CASE WHEN mp.role = 'DPS' AND mp.result = 'L' THEN 1 ELSE 0 END) AS dps_l,

      -- Healer
      SUM(CASE WHEN mp.role = 'Healer' AND mp.result = 'W' THEN 1 ELSE 0 END) AS heal_w,
      SUM(CASE WHEN mp.role = 'Healer' AND mp.result = 'L' THEN 1 ELSE 0 END) AS heal_l,

      SUM(mp.result = 'W') AS wins,
      SUM(mp.result = 'L') AS losses

    FROM players p
    JOIN match_players mp ON p.id = mp.player_id
    JOIN matches m ON mp.match_id = m.id
    WHERE 1=1
    ${dateCondition}
    GROUP BY p.id
    ORDER BY games DESC;
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});






/* =========================
   특정 플레이어 경기 상세
========================= */
app.get("/api/player/:id/matches", (req, res) => {
  const playerId = req.params.id;
const date = req.query.date || null;

  const sql = `
    SELECT
      m.id AS match_id,
      m.created_at,
      mp.team,
      mp.role,
      mp.result
    FROM match_players mp
    JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = ?
AND (? IS NULL OR DATE(m.created_at) = ?)
    ORDER BY m.id ASC
  `;

  db.all(sql, [playerId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

/* =========================
   경기 날짜 목록 조회
========================= */
app.get("/api/match-dates", (req, res) => {
  const sql = `
    SELECT DISTINCT DATE(created_at) AS match_date
    FROM matches
    ORDER BY match_date DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

/* =========================
   특정 날짜의 경기 상세
========================= */
app.get("/api/matches/by-date/:date", (req, res) => {
  const date = req.params.date;

  const sql = `
    SELECT
      m.id AS match_id,
      m.created_at,
      p.name,
      mp.team,
      mp.role,
      mp.result
    FROM matches m
    JOIN match_players mp ON m.id = mp.match_id
    JOIN players p ON mp.player_id = p.id
    WHERE DATE(m.created_at) = ?
    ORDER BY m.id ASC
  `;

  db.all(sql, [date], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});




/* =========================
   관리자: 경기 수정
========================= */
app.put("/api/admin/match/:id", (req, res) => {
  const { winner, created_at } = req.body;
  const id = req.params.id;

  db.run(
    "UPDATE matches SET winner = ?, created_at = ? WHERE id = ?",
    [winner, created_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/* =========================
   관리자: 경기 삭제
========================= */
app.delete("/api/admin/match/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM match_players WHERE match_id = ?", [id]);
  db.run("DELETE FROM matches WHERE id = ?", [id]);

  res.json({ success: true });
});

/* =========================
   관리자: 특정 경기 상세
========================= */
app.get("/api/admin/match/:id", (req, res) => {
  const matchId = req.params.id;

  const sql = `
    SELECT
      mp.id AS mp_id,
      p.id AS player_id,
      p.name,
      mp.team,
      mp.role,
      mp.result
    FROM match_players mp
    JOIN players p ON mp.player_id = p.id
    WHERE mp.match_id = ?
  `;

  db.all(sql, [matchId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


/* =========================
   관리자: 경기 전체 수정
========================= */
app.put("/api/admin/match-full/:id", (req, res) => {
  const matchId = req.params.id;
  const { created_at, winner, players } = req.body;

  // 1️⃣ 경기 정보 수정
  db.run(
    "UPDATE matches SET created_at = ?, winner = ? WHERE id = ?",
    [created_at, winner, matchId]
  );

  // 2️⃣ 기존 match_players 삭제
  db.run(
    "DELETE FROM match_players WHERE match_id = ?",
    [matchId],
    () => {
      // 3️⃣ 새 플레이어 정보 삽입
      players.forEach(p => {
        db.run(
          `INSERT INTO match_players
           (match_id, player_id, team, role, result)
           VALUES (?, ?, ?, ?, ?)`,
          [matchId, p.player_id, p.team, p.role, p.result]
        );
      });

      res.json({ success: true });
    }
  );
});


/* =========================
   관리자: 경기 목록 조회
========================= */
app.get("/api/admin/matches", (req, res) => {
  const sql = `
    SELECT
      id,
      created_at,
      winner
    FROM matches
    ORDER BY created_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

/* 
수정해보기 
*/
/* =========================
   관리자: 경기 정보 수정
   (날짜, 승리팀)
========================= */
app.get("/api/admin/match/:id", (req, res) => {
  const matchId = req.params.id;

  db.get(
    `SELECT id, winner, created_at, map_name, ban_a, ban_b
     FROM matches
     WHERE id = ?`,
    [matchId],
    (err, match) => {
      if (err) return res.status(500).json(err);

      db.all(
        `SELECT
           mp.player_id,
           mp.team,
           mp.role
         FROM match_players mp
         WHERE mp.match_id = ?`,
        [matchId],
        (err, players) => {
          if (err) return res.status(500).json(err);

          res.json({ match, players });
        }
      );
    }
  );
});

//관리자에서 수정
app.get("/api/admin/matches", (req, res) => {
  db.all(`SELECT * FROM matches ORDER BY created_at DESC`, [], (e, rows) => {
    res.json(rows);
  });
});

app.get("/api/admin/matches", (req, res) => {
  db.all(`SELECT * FROM matches ORDER BY created_at DESC`, [], (e, rows) => {
    res.json(rows);
  });
});

app.put("/api/admin/match-full/:id", (req, res) => {
  const { created_at, map_name, ban_a, ban_b, winner, players } = req.body;
  const id = req.params.id;

  db.run(`
    UPDATE matches
    SET created_at = ?, map_name = ?, ban_a = ?, ban_b = ?, winner = ?
    WHERE id = ?
  `, [`${created_at} 12:00:00`, map_name, ban_a, ban_b, winner, id]);

  players.forEach(p => {
    db.run(`
      UPDATE match_players
      SET team = ?, role = ?, result = ?
      WHERE match_id = ? AND player_id = ?
    `, [p.team, p.role, p.result, id, p.player_id]);
  });

  res.json({ ok: true });
});





const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
