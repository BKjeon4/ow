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
  document.getElementById("adminNav")?.style.setProperty("display", "none");
  document.getElementById("dateSection")?.style.setProperty("display", "none");
  document.getElementById("statsSection")?.style.setProperty("display", "none");

  fetch(`/api/admin/match/${matchId}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(({ match, players }) => {
      console.log("✅ 받은 경기 데이터:", match);
      console.log("✅ 받은 선수 데이터:", players);

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
        // 역할 정규화
        let role = p.role;
        if (role === "Heal") role = "Healer";
        if (role === "Support") role = "Healer";

        if (!grouped[p.team] || !grouped[p.team][role]) {
          console.warn("⚠️ 잘못된 팀/역할:", p);
          return;
        }

        grouped[p.team][role].push(p.player_id);
      });

      console.log("📊 그룹화된 데이터:", grouped);

      // 순서대로 채우기
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
            console.log(`✅ ${team} ${role} 슬롯에 ${slot.value} 배치`);
          }
        });
      });

      alert(`경기 ${matchId} 수정 모드`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
    .catch(err => {
      console.error("❌ 경기 로드 실패:", err);
      alert("경기 정보를 불러오는데 실패했습니다: " + err.message);
      
      // 에러 시 원래 상태로 복구
      isEditMode = false;
      editingMatchId = null;
      document.getElementById("saveBtn").textContent = "💾 저장";
      document.getElementById("adminNav")?.style.setProperty("display", "block");
      document.getElementById("dateSection")?.style.setProperty("display", "block");
      document.getElementById("statsSection")?.style.setProperty("display", "block");
    });
}





/*************************************************
 * 경기 저장 (신규 / 수정 공용)
 *************************************************/
function saveMatch() {
  if (!isAdmin) return alert("관리자만 가능합니다");
  if (!winnerTeam) return alert("승리 팀을 선택해주세요");

  // ⭐ 유효성 검사
  const matchDate = document.getElementById("matchDate").value;
  const mapName = document.getElementById("mapName").value.trim();
  const banA = document.getElementById("banA").value.trim();
  const banB = document.getElementById("banB").value.trim();

  // 날짜 체크
  if (!matchDate) {
    return alert("경기 날짜를 선택해주세요");
  }

  // 맵 체크
  if (!mapName) {
    return alert("맵 이름을 입력해주세요");
  }

  // 밴픽 체크
  if (!banA || !banB) {
    return alert("양 팀의 밴픽을 모두 입력해주세요");
  }

  // 선수 선택 및 중복 체크
  const selectedPlayers = [];
  const entries = [];

  for (let slot of slots) {
    const playerId = slot.value;
    
    // 선수 미선택 체크
    if (!playerId) {
      return alert("모든 슬롯에 선수를 선택해주세요");
    }

    // 중복 선수 체크
    if (selectedPlayers.includes(playerId)) {
      const playerName = slot.options[slot.selectedIndex].text;
      return alert(`${playerName} 선수가 중복 선택되었습니다`);
    }

    selectedPlayers.push(playerId);

    entries.push({
      playerId: Number(playerId),
      team: slot.dataset.team,
      role: slot.dataset.role,
      result: slot.dataset.team === winnerTeam ? "W" : "L"
    });
  }

  // ⭐ 모든 검사 통과 후 저장
  const body = {
    winner: winnerTeam,
    created_at: matchDate,
    map_name: mapName,
    ban_a: banA,
    ban_b: banB,
    entries: entries
  };

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

    // 수정 모드였으면 관리자 페이지로 이동
    if (isEditMode) {
      location.href = "/admin.html";
      return;
    }

    // 신규 저장인 경우에만 초기화
    winnerTeam = null;
    slots.forEach(s => s.value = "");
    document.getElementById("matchDate").value = "";
    document.getElementById("mapName").value = "";
    document.getElementById("banA").value = "";
    document.getElementById("banB").value = "";

    loadStats();
    loadMatchDates();
  });
}

/*************************************************
 * 통계 로드
 *************************************************/
function loadStats(date = null) {
  currentDateFilter = date;

  const url = date
    ? `/api/stats?date=${date}`
    : `/api/stats`;

  fetch(url)
    .then(res => res.json())
    .then(rows => {
      currentStats = rows;
      renderStats(rows);
    })
    .catch(err => {
      console.error("통계 로드 실패:", err);
      alert("통계를 불러오는데 실패했습니다.");
    });
}

/*************************************************
 * 통계 렌더링
 *************************************************/
function renderStats(rows) {
  let html = `
    <table>
      <tr>
       <th onclick="sortBy('name')">ID ⬍</th>
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
/*************************************************
 * 정렬
 *************************************************/
function sortBy(key) {
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = false; // 기본은 내림차순
  }

  const sorted = [...currentStats].sort((a, b) => {
    let va, vb;
    
    if (key === "winrate") {
      va = a.games ? a.wins / a.games : 0;
      vb = b.games ? b.wins / b.games : 0;
    } else if (key === "name") {
      // ⭐ 이름(문자열) 정렬
      va = a.name.toLowerCase(); // 대소문자 구분 없이
      vb = b.name.toLowerCase();
      
      // 문자열 비교
      if (currentSort.asc) {
        return va < vb ? -1 : va > vb ? 1 : 0;
      } else {
        return va > vb ? -1 : va < vb ? 1 : 0;
      }
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

      // ✅ 전체 조회 버튼
      const allBtn = document.createElement("button");
      allBtn.className = "date-btn";
      allBtn.textContent = "전체 조회";
      allBtn.addEventListener("click", () => {
        currentDateFilter = null;
        loadStats(null);  // null을 명시적으로 전달
        
        // 모든 버튼 활성화 해제
        document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
        allBtn.classList.add("active");
      });
      box.appendChild(allBtn);

      // 기본적으로 전체 조회 버튼 활성화
      if (!currentDateFilter) {
        allBtn.classList.add("active");
      }

      // 날짜 버튼들
      dates.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "date-btn";
        btn.textContent = d.match_date;

        // 현재 선택된 날짜면 활성화
        if (currentDateFilter === d.match_date) {
          btn.classList.add("active");
        }

        btn.addEventListener("click", () => {
          currentDateFilter = d.match_date;
          loadStats(d.match_date);
          
          // 모든 버튼 활성화 해제 후 현재 버튼만 활성화
          document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
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
            <td>${r.created_at}</td>
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


