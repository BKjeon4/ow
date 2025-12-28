/*************************************************
 * 전역 상태
 *************************************************/
if (!sessionStorage.getItem("adminSession")) {
  localStorage.removeItem("isAdmin");
}

let players = [];
let winnerTeam = null;
let currentStats = [];          
let currentSort = { key: null, asc: false };
let currentDateFilter = null;
let editingMatchId = null;
const slots = document.querySelectorAll(".slot");
const isAdmin = localStorage.getItem("isAdmin") === "true";

/*************************************************
 * 페이지 초기화
 *************************************************/
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminArea").style.display = isAdmin ? "block" : "none";
  document.getElementById("loginBtn").style.display = isAdmin ? "none" : "inline-block";
  document.getElementById("logoutBtn").style.display = isAdmin ? "inline-block" : "none";

  loadPlayers();
  loadMatchDates();
  loadStats();

  // ⭐ 관리자에서 수정 눌러서 들어온 경우
  const editId = sessionStorage.getItem("editMatchId");
  if (editId) {
    sessionStorage.removeItem("editMatchId");
    editMatch(editId);
  }
});


/*************************************************
 * 로그인
 *************************************************/
function goLogin() {
  location.href = "/admin-login.html";
}

function logout() {
  localStorage.removeItem("isAdmin");
  sessionStorage.removeItem("adminSession");
  alert("로그아웃 되었습니다");
  location.reload();
}

/*************************************************
 * 플레이어 로드
 *************************************************/
function loadPlayers() {
  fetch("/api/players")
    .then(res => res.json())
    .then(data => {
      players = data;
      slots.forEach(slot => {
        slot.innerHTML = `<option value="">-- 선택 --</option>`;
        players.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name;
          slot.appendChild(opt);
        });
      });
    });
}

/*************************************************
 * 승리 팀 선택
 *************************************************/
function setWinner(team) {
  winnerTeam = team;
  alert(`TEAM ${team} 승리 선택`);
}

/*************************************************
 * 수정 모드 진입
 *************************************************/
let isEditMode = false;

function editMatch(matchId) {
  editingMatchId = matchId;
  isEditMode = true;

  // UI 전환
  document.getElementById("saveBtn").textContent = "수정";

  // 관리자 버튼 숨김
 // ===== 수정 모드 UI 숨김 =====
document.getElementById("adminNav")?.style.setProperty("display", "none");
document.getElementById("dateSection")?.style.setProperty("display", "none");
document.getElementById("statsSection")?.style.setProperty("display", "none");

  fetch(`/api/admin/match/${matchId}`)
    .then(res => res.json())
    .then(({ match, players }) => {

      // 기본 정보
      document.getElementById("matchDate").value = match.created_at;
      document.getElementById("mapName").value = match.map_name || "";
      document.getElementById("banA").value = match.ban_a || "";
      document.getElementById("banB").value = match.ban_b || "";

      winnerTeam = match.winner;

      // 슬롯 초기화
      slots.forEach(s => s.value = "");

      // 팀/역할별 그룹
      const grouped = {
        A: { Tank: [], DPS: [], Healer: [] },
        B: { Tank: [], DPS: [], Healer: [] }
      };

players.forEach(p => {
  // ⭐ role 정규화 (DB가 좀 꼬여도 안전)
  let role = p.role;
  if (role === "Heal") role = "Healer";
  if (role === "Support") role = "Healer";

  if (!grouped[p.team] || !grouped[p.team][role]) return;

  grouped[p.team][role].push(p.player_id);
});


      // ⭐ 순서대로 채우기
      ["A", "B"].forEach(team => {
        ["Tank", "DPS", "DPS", "Healer", "Healer"].forEach(role => {
          const slot = [...slots].find(
            s =>
              s.dataset.team === team &&
              s.dataset.role === role &&
              !s.value
          );
          if (slot && grouped[team][role].length) {
            slot.value = grouped[team][role].shift();
          }
        });
      });

      alert(`경기 ${matchId} 수정 모드`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
}






/*************************************************
 * 경기 저장 (신규 / 수정 공용)
 *************************************************/
function saveMatch() {
  if (!isAdmin) return alert("관리자만 가능합니다");
  if (!winnerTeam) return alert("승리 팀 선택");

  const body = {
    winner: winnerTeam,
    created_at: document.getElementById("matchDate").value,
    map_name: document.getElementById("mapName").value,
    ban_a: document.getElementById("banA").value,
    ban_b: document.getElementById("banB").value,
    entries: []
  };

  slots.forEach(slot => {
    if (!slot.value) return;
    body.entries.push({
      playerId: Number(slot.value),
      team: slot.dataset.team,
      role: slot.dataset.role,
      result: slot.dataset.team === winnerTeam ? "W" : "L"
    });
  });

  const url = isEditMode
    ? `/api/admin/match-full/${editingMatchId}`
    : `/api/match`;

  const method = isEditMode ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(() => {
    alert(isEditMode ? "경기 수정 완료" : "경기 저장 완료");

    // 상태 초기화
    isEditMode = false;
    editingMatchId = null;
    winnerTeam = null;

    document.getElementById("saveBtn").textContent = "💾 저장";
    slots.forEach(s => s.value = "");
    document.getElementById("matchDate").value = "";
    document.getElementById("mapName").value = "";
    document.getElementById("banA").value = "";
    document.getElementById("banB").value = "";

// ===== 수정 모드 UI 복구 =====
document.getElementById("adminNav")?.style.setProperty("display", "block");
document.getElementById("dateSection")?.style.setProperty("display", "block");
document.getElementById("statsSection")?.style.setProperty("display", "block");


    loadStats();
    loadMatchDates();
  });
}


/*************************************************
 * 통계 로드
 *************************************************/
function loadStats(date = null) {
  currentDateFilter = date;
  const url = date ? `/api/stats?date=${date}` : `/api/stats`;

  fetch(url)
    .then(res => res.json())
    .then(rows => {
      currentStats = rows;
      renderStats(rows);
    });
}

/*************************************************
 * 통계 렌더링
 *************************************************/
function renderStats(rows) {
  let html = `
    <table>
      <tr>
        <th>선수</th>
        <th onclick="sortBy('games')">출전 ⬍</th>
        <th>탱</th>
        <th>딜</th>
        <th>힐</th>
        <th>승</th>
        <th>패</th>
        <th onclick="sortBy('winrate')">승률 ⬍</th>
      </tr>
  `;

  rows.forEach(r => {
    const winrate = r.games ? ((r.wins / r.games) * 100).toFixed(1) : "0.0";

    html += `
      <tr>
        <td>
          <a href="#"
             onclick="openPlayerModal(${r.id}, '${r.name.replace(/'/g, "\\'")}'); return false;">
            ${r.name}
          </a>
        </td>
        <td>${r.games}</td>
        <td>${r.tank_w}/${r.tank_l}</td>
        <td>${r.dps_w}/${r.dps_l}</td>
        <td>${r.heal_w}/${r.heal_l}</td>
        <td>${r.wins}</td>
        <td>${r.losses}</td>
        <td>${winrate}%</td>
      </tr>
    `;
  });

  html += "</table>";
  document.getElementById("stats").innerHTML = html;
}

/*************************************************
 * 정렬
 *************************************************/
function sortBy(key) {
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = false;
  }

  const sorted = [...currentStats].sort((a, b) => {
    let va, vb;
    if (key === "winrate") {
      va = a.games ? a.wins / a.games : 0;
      vb = b.games ? b.wins / b.games : 0;
    } else {
      va = a[key];
      vb = b[key];
    }
    return currentSort.asc ? va - vb : vb - va;
  });

  renderStats(sorted);
}

/*************************************************
 * 날짜 목록
 *************************************************/
function loadMatchDates() {
  fetch("/api/match-dates")
    .then(res => res.json())
    .then(dates => {
      const box = document.getElementById("dateList");
      box.innerHTML = "";

      dates.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "date-btn";
        btn.textContent = d.match_date;

        btn.addEventListener("click", () => {
          currentDateFilter = d.match_date;
          loadStats(d.match_date);
        });

        box.appendChild(btn);
      });
    });
}


/*************************************************
 * 선수 모달 (날짜 필터 적용)
 *************************************************/
function openPlayerModal(playerId, playerName) {
  document.getElementById("modalTitle").textContent =
    `${playerName} 경기 상세`;

  const query = currentDateFilter
    ? `?date=${currentDateFilter}`
    : "";

  fetch(`/api/player/${playerId}/matches${query}`)
    .then(res => res.json())
    .then(rows => {
      let html = `
        <tr>
          <th>날짜</th>
          <th>팀</th>
          <th>역할</th>
          <th>결과</th>
        </tr>
      `;

      rows.forEach(r => {
        html += `
          <tr>
          <td>${r.created_at.slice(0, 10)}</td>
            <td>TEAM ${r.team}</td>
            <td>${r.role}</td>
            <td>${r.result}</td>
          </tr>
        `;
      });

      document.getElementById("modalTable").innerHTML = html;
      document.getElementById("playerModal").style.display = "block";
    });
}


function closeModal() {
  document.getElementById("playerModal").style.display = "none";
}

/*************************************************
 * 관리자 페이지 이동
 *************************************************/
function goAdmin() {
  location.href = "/admin.html";
}


