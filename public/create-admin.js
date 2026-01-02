import bcrypt from 'bcryptjs';
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createInitialAdmin() {
  const username = "admin";
  const password = "admin123"; 
  const name = "최고관리자";

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("admins")
    .insert({ username, password: hashedPassword, name })
    .select();

  if (error) {
    console.error("에러:", error);
  } else {
    console.log("✅ 초기 관리자 생성 완료:", data);
    console.log("아이디:", username);
    console.log("비밀번호:", password);
  }

  process.exit();
}

createInitialAdmin();