import bcrypt from 'bcryptjs';
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateAdminPassword() {
  const username = "admin";
  const newPassword = "mcbscrimbbbb123"; 

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const { data, error } = await supabase
    .from("admins")
    .update({ password: hashedPassword })
    .eq("username", username)
    .select();

  if (error) {
    console.error("❌ 에러:", error);
  } else {
    console.log("✅ 비밀번호 변경 완료:", data);
    console.log("아이디:", username);
    console.log("새 비밀번호:", newPassword);
  }

  process.exit();
}

updateAdminPassword();