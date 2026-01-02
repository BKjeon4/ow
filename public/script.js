/*************************************************
 * 전역 상태
 *************************************************/
let adminInfo = null;

// 관리자 세션 확인
const adminSession = sessionStorage.getItem("adminSession");
if (adminSession) {
  adminInfo = JSON.parse(adminSession);
} else {
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
  alert("Logged out");
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
        slot.innerHTML = `<option value="">-- Select --</option>`;
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
  alert(`TEAM ${team} Win Selected`);
}

/*************************************************
 * 수정 모드 진입
 *************************************************/
let isEditMode = false;

function editMatch(matchId) {
  editingMatchId = matchId;
  isEditMode = true;

  // UI 전환
  document.getElementById("saveBtn").textContent = "Update";
  
  // 뒤로가기 버튼 표시
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.style.display = "inline-block";
  }

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
      console.log("✅ Match data received:", match);
      console.log("✅ Player data received:", players);

      // ⭐ 날짜 형식 변환 (ISO → datetime-local)
      let formattedDate = match.created_at;
      if (formattedDate.includes('T')) {
        // "2025-12-27T10:30:00.000Z" → "2025-12-27T10:30"
        formattedDate = formattedDate.slice(0, 16);
      }

      // 기본 정보
      document.getElementById("matchDate").value = formattedDate;
      document.getElementById("mapName").value = match.map_name || "";
      document.getElementById("banA").value = match.ban_a || "";
      document.getElementById("banB").value = match.ban_b || "";

      winnerTeam = match.winner;

      // ⭐⭐⭐ 슬롯 완전 초기화
      slots.forEach(s => {
        s.value = "";
        s.selectedIndex = 0;
      });

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
          console.warn("⚠️ Invalid team/role:", p);
          return;
        }

        grouped[p.team][role].push(p.player_id);
      });

      console.log("📊 Grouped data:", grouped);

      // ⭐⭐⭐ 슬롯을 배열로 변환하고 인덱스로 관리
      const slotArray = Array.from(slots);
      
      // 각 팀/역할별로 슬롯 찾아서 채우기
      ["A", "B"].forEach(team => {
        const roles = ["Tank", "DPS", "DPS", "Healer", "Healer"];
        const roleCount = { Tank: 0, DPS: 0, Healer: 0 };

        roles.forEach(role => {
          // 해당 팀/역할의 N번째 슬롯 찾기
          const slot = slotArray.find(s => {
            if (s.dataset.team !== team || s.dataset.role !== role) {
              return false;
            }
            
            // 이미 채워진 슬롯은 건너뛰기 위해 카운트 확인
            const currentIndex = roleCount[role];
            const slotsOfSameRole = slotArray.filter(
              x => x.dataset.team === team && x.dataset.role === role
            );
            
            return s === slotsOfSameRole[currentIndex];
          });

          if (slot && grouped[team][role].length > 0) {
            const playerId = grouped[team][role].shift();
            slot.value = playerId;
            console.log(`✅ ${team} ${role} slot filled with ${playerId}`);
          }
          
          roleCount[role]++;
        });
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    })
    .catch(err => {
      console.error("❌ Failed to load match:", err);
      alert("Failed to load match info: " + err.message);
      
      // 에러 시 원래 상태로 복구
      cancelEdit();
    });
}

/*************************************************
 * 수정 모드 취소 (뒤로가기)
 *************************************************/
function cancelEdit() {
  if (isEditMode) {
    if (!confirm("Cancel editing and return to admin page?")) {
      return;
    }
  }
  
  // 상태 초기화
  isEditMode = false;
  editingMatchId = null;
  winnerTeam = null;
  
  // UI 복구
  document.getElementById("saveBtn").textContent = "💾 Save";
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.style.display = "none";
  }
  
  // ⭐ 폼 완전 초기화
  slots.forEach(slot => {
    slot.value = "";
    slot.selectedIndex = 0;
  });
  document.getElementById("matchDate").value = "";
  document.getElementById("mapName").value = "";
  document.getElementById("banA").value = "";
  document.getElementById("banB").value = "";
  
  // 숨겼던 섹션 복구
  document.getElementById("adminNav")?.style.setProperty("display", "block");
  document.getElementById("dateSection")?.style.setProperty("display", "block");
  document.getElementById("statsSection")?.style.setProperty("display", "block");
  
  // 관리자 페이지로 이동
  location.href = "/admin.html";
}


/*************************************************
 * 경기 저장 (신규 / 수정 공용)
 *************************************************/
function saveMatch() {
  if (!isAdmin) return alert("Admin only");
  if (!adminInfo) return alert("Admin info not found. Please log in again");
  if (!winnerTeam) return alert("Please select winning team");

  // ⭐ 유효성 검사
  const matchDate = document.getElementById("matchDate").value;
  const mapName = document.getElementById("mapName").value.trim();
  const banA = document.getElementById("banA").value.trim();
  const banB = document.getElementById("banB").value.trim();

  // 날짜 체크
  if (!matchDate) {
    return alert("Please select match date");
  }

  // 맵 체크
  if (!mapName) {
    return alert("Please enter map name");
  }

  // 밴픽 체크
  if (!banA || !banB) {
    return alert("Please enter bans for both teams");
  }

  // 선수 선택 및 중복 체크
  const selectedPlayers = [];
  const entries = [];

  for (let slot of slots) {
    const playerId = slot.value;
    
    // 선수 미선택 체크
    if (!playerId) {
      return alert("Please select all players");
    }

    // 중복 선수 체크
    if (selectedPlayers.includes(playerId)) {
      const playerName = slot.options[slot.selectedIndex].text;
      return alert(`${playerName} is selected multiple times`);
    }

    selectedPlayers.push(playerId);

    entries.push({
      playerId: Number(playerId),
      team: slot.dataset.team,
      role: slot.dataset.role,
      result: slot.dataset.team === winnerTeam ? "W" : "L"
    });
  }

  // ⭐ datetime-local 값을 로컬 시간대 유지하면서 ISO 형식으로 변환
  const localDate = new Date(matchDate);
  const offsetMs = localDate.getTimezoneOffset() * 60000;
  const utcDate = new Date(localDate.getTime() - offsetMs);
  const created_at = utcDate.toISOString();
  
  console.log("Input time:", matchDate);
  console.log("Local Date:", localDate);
  console.log("Convert to UTC:", created_at);
  
  // ⭐ 모든 검사 통과 후 저장
  const body = {
    winner: winnerTeam,
    created_at: created_at,
    map_name: mapName,
    ban_a: banA,
    ban_b: banB,
    entries: entries,
    admin_id: adminInfo.id,
    admin_name: adminInfo.name
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
    alert(isEditMode ? "Match updated" : "Match saved");

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
      console.error("Failed to load stats:", err);
      alert("Failed to load statistics");
    });
}

/*************************************************
 * 통계 렌더링
 *************************************************/
function renderStats(rows) {
  let html = `
    <table>
      <tr>
       <th onclick="sortBy('name')">Player ⬍</th>
        <th onclick="sortBy('games')">Games ⬍</th>
        <th>Tank</th>
        <th>DPS</th>
        <th>Support</th>
        <th>Win</th>
        <th>Loss</th>
        <th onclick="sortBy('winrate')">Win Rate ⬍</th>
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
    currentSort.asc = false; // 기본은 내림차순
  }

  const sorted = [...currentStats].sort((a, b) => {
    let va, vb;
    
    if (key === "winrate") {
      va = a.games ? a.wins / a.games : 0;
      vb = b.games ? b.wins / b.games : 0;
    } else if (key === "name") {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
      
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
      allBtn.textContent = "All Matches";
      allBtn.addEventListener("click", () => {
        currentDateFilter = null;
        loadStats(null);
        
        document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
        allBtn.classList.add("active");
      });
      box.appendChild(allBtn);

      if (!currentDateFilter) {
        allBtn.classList.add("active");
      }

      // 날짜 버튼들
      dates.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "date-btn";
        btn.textContent = d.match_date;

        if (currentDateFilter === d.match_date) {
          btn.classList.add("active");
        }

        btn.addEventListener("click", () => {
          currentDateFilter = d.match_date;
          loadStats(d.match_date);
          
          document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        });

        box.appendChild(btn);
      });
    });
}


/*************************************************
 * 선수 모달
 *************************************************/
function openPlayerModal(playerId, playerName) {
  document.getElementById("modalTitle").textContent =
    `${playerName} Match Details`;

  const query = currentDateFilter
    ? `?date=${currentDateFilter}`
    : "";

  fetch(`/api/player/${playerId}/matches${query}`)
    .then(res => res.json())
    .then(rows => {
      let html = `
        <tr>
          <th>Date</th>
          <th>Team</th>
          <th>Role</th>
          <th>Result</th>
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