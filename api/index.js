import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(express.static("public"));

app.get("/api/players", async (req, res) => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("name");

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* 🔥 listen 절대 쓰지 말 것 */
export default app;
