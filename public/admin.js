/* =========================
   플레이어 관리
========================= */
function loadPlayers() {
  fetch("/api/players")
    .then(res => res.json())
    .then(players => {
      const ul = document.getElementById("playerList");
      ul.innerHTML = "";

      players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = p.name + " ";

        const del = document.createElement("button");
        del.textContent = "삭제";
        del.onclick = () => deletePlayer(p.id);

        li.appendChild(del);
        ul.appendChild(li);
      });
    });
}

function addPlayer() {
  const input = document.getElementById("newPlayerName");
  const name = input.value.trim();
  if (!name) return alert("이름 입력");

  fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  })
    .then(res => res.json())
    .then(result => {
      if (result.error === "DUPLICATE") {
        alert("이미 등록된 플레이어입니다");
      } else {
        input.value = "";
        loadPlayers();
      }
    });
}

function deletePlayer(id) {
  if (!confirm("삭제할까요?")) return;

  fetch(`/api/player/${id}`, { method: "DELETE" })
    .then(() => loadPlayers());
}

/* =========================
   경기 목록
========================= */
function loadMatches() {
  fetch("/api/admin/matches")
    .then(res => res.json())
    .then(matches => {
      let html = `
        <table>
          <tr>
            <th>ID</th>
            <th>날짜</th>
            <th>맵</th>
            <th>승리</th>
            <th>관리</th>
          </tr>
      `;

      matches.forEach(m => {
        html += `
          <tr>
            <td>${m.id}</td>
            <td>${m.created_at}</td>
            <td>${m.map_name || "-"}</td>
            <td>${m.winner}</td>
            <td>
              <button onclick="editMatchFromAdmin(${m.id})">✏️ 수정</button>
              <button onclick="deleteMatch(${m.id})">🗑 삭제</button>
            </td>
          </tr>
        `;
      });

      html += "</table>";
      document.getElementById("matchList").innerHTML = html;
    });
}

function deleteMatch(id) {
  if (!confirm("경기를 삭제할까요?")) return;
  fetch(`/api/admin/match/${id}`, { method: "DELETE" })
    .then(() => loadMatches());
}

/* =========================
   초기 로드
========================= */
loadPlayers();
loadMatches();
