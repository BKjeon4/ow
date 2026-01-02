/* =========================
   날짜 포맷팅 유틸리티
========================= */
function formatDateTime(isoString) {
  if (!isoString) return '';
  
  // "2025-12-27" 형식 (날짜만)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString + ' 00:00';
  }
  
  // 시간대 정보가 없으면 UTC로 간주하고 'Z' 추가
  let dateString = isoString;
  if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
    dateString = dateString + 'Z';
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return isoString;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

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
        del.textContent = "Delete";
        del.onclick = () => deletePlayer(p.id);

        li.appendChild(del);
        ul.appendChild(li);
      });
    });
}

function addPlayer() {
  const input = document.getElementById("newPlayerName");
  const name = input.value.trim();
  if (!name) return alert("Please enter a name");

  fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  })
    .then(res => res.json())
    .then(result => {
      if (result.error === "DUPLICATE") {
        alert("Player already exists");
      } else {
        input.value = "";
        loadPlayers();
      }
    });
}

function deletePlayer(id) {
  if (!confirm("Delete this player?")) return;

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
            <th>Date</th>
            <th>Map</th>
            <th>Winner</th>
            <th>Actions</th>
          </tr>
      `;

      matches.forEach(m => {
        html += `
          <tr>
            <td>${m.id}</td>
            <td>${formatDateTime(m.created_at)}</td>
            <td>${m.map_name || "-"}</td>
            <td>${m.winner}</td>
            <td>
              <button onclick="editMatchFromAdmin(${m.id})">✏️ Edit</button>
              <button onclick="deleteMatch(${m.id})">🗑 Delete</button>
            </td>
          </tr>
        `;
      });

      html += "</table>";
      document.getElementById("matchList").innerHTML = html;
    });
}

function deleteMatch(id) {
  if (!confirm("Delete this match?")) return;
  
  const adminSession = sessionStorage.getItem("adminSession");
  const adminInfo = adminSession ? JSON.parse(adminSession) : null;
  
  if (!adminInfo) {
    alert("Admin info not found. Please log in again");
    return;
  }

  const url = `/api/admin/match/${id}?admin_id=${adminInfo.id}&admin_name=${encodeURIComponent(adminInfo.name)}`;
  
  fetch(url, { method: "DELETE" })
    .then(res => {
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    })
    .then(() => {
      alert("Deleted successfully");
      loadMatches();
    })
    .catch(err => {
      console.error("Delete failed:", err);
      alert("Failed to delete");
    });
}

/* =========================
   관리자 관리
========================= */
function loadAdmins() {
  fetch("/api/admins")
    .then(res => res.json())
    .then(admins => {
      let html = `
        <table>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Name</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
      `;

      admins.forEach(a => {
        html += `
          <tr>
            <td>${a.id}</td>
            <td>${a.username}</td>
            <td>${a.name}</td>
            <td>${formatDateTime(a.created_at)}</td>
            <td>
              <button onclick="deleteAdmin(${a.id})">Delete</button>
            </td>
          </tr>
        `;
      });

      html += "</table>";
      document.getElementById("adminList").innerHTML = html;
    });
}

function addAdmin() {
  const username = document.getElementById("newAdminUsername").value.trim();
  const password = document.getElementById("newAdminPassword").value.trim();
  const name = document.getElementById("newAdminName").value.trim();

  if (!username || !password || !name) {
    return alert("Please fill in all fields");
  }

  if (password.length < 6) {
    return alert("Password must be at least 6 characters");
  }

  fetch("/api/admin/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name })
  })
  .then(res => res.json())
  .then(result => {
    if (result.error) {
      alert(result.error);
    } else {
      alert("Admin added successfully");
      document.getElementById("newAdminUsername").value = "";
      document.getElementById("newAdminPassword").value = "";
      document.getElementById("newAdminName").value = "";
      loadAdmins();
    }
  });
}

function deleteAdmin(id) {
  if (!confirm("Delete this admin?")) return;

  fetch(`/api/admin/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        alert(result.error);
      } else {
        alert("Deleted successfully");
        loadAdmins();
      }
    });
}

/* =========================
   활동 로그
========================= */
function loadLogs() {
  fetch("/api/admin/logs")
    .then(res => res.json())
    .then(logs => {
      let html = `
        <table>
          <tr>
            <th>Time</th>
            <th>Admin</th>
            <th>Action</th>
          </tr>
      `;

      logs.forEach(log => {
        const date = formatDateTime(log.created_at);
        const adminName = log.admins ? log.admins.name : 'Unknown';
        
        html += `
          <tr>
            <td>${date}</td>
            <td>${adminName}</td>
            <td>${log.action}</td>
          </tr>
        `;
      });

      html += "</table>";
      document.getElementById("logList").innerHTML = html;
    });
}

/* =========================
   초기 로드
========================= */
loadPlayers();
loadMatches();