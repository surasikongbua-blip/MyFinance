# MyFinance

## ตั้งรหัสผ่านผู้ใช้โดย Admin

หน้า “จัดการผู้ใช้” มีปุ่ม **🔑 รหัสผ่าน** สำหรับตั้งรหัสผ่านใหม่ให้ผู้ใช้ทุกคน รวมถึงบัญชี Admin ที่กำลังใช้งานอยู่ รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และต้องกรอกยืนยันให้ตรงกัน ระบบจะไม่ส่งรหัสผ่านให้ผู้ใช้โดยอัตโนมัติ ให้แจ้งผู้ใช้ผ่านช่องทางที่ปลอดภัย

การเปลี่ยนรหัสผ่านทำผ่าน Supabase Edge Function ชื่อ `admin-set-user-password` ซึ่งตรวจ JWT, ตรวจบทบาทและสถานะอนุมัติจาก RPC `admin_get_profiles` และยืนยันว่าผู้ใช้เป้าหมายอยู่ในระบบก่อนใช้ Auth Admin API เปลี่ยนรหัสผ่าน คีย์ `service_role` ใช้เฉพาะใน runtime ของ Edge Function และห้ามใส่ใน `index.html` หรือ commit ลง repository ตามแนวทางของ [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)

### Deploy ไปยัง Supabase

1. ติดตั้ง Supabase CLI และเข้าสู่ระบบด้วย `supabase login`.
2. เชื่อม repo นี้กับโปรเจกต์ Supabase (`jiwpbwfbkblsfymouzsn`) ด้วย `supabase link --project-ref jiwpbwfbkblsfymouzsn`.
3. ตรวจใน Supabase Dashboard → Edge Functions → Secrets ว่า runtime มี `SUPABASE_URL`, `SUPABASE_ANON_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` พร้อมใช้งาน โดยเก็บ service role key ไว้ฝั่ง Supabase เท่านั้น.
4. Deploy ด้วย `supabase functions deploy admin-set-user-password`.
5. เปิดเว็บผ่าน GitHub Pages หรือ local server ที่ `http://localhost:3000` / `http://127.0.0.1:3000`; function จำกัด CORS ให้ origin เหล่านี้ หากย้ายโดเมนเว็บ ให้แก้ `allowedOrigins` ใน `supabase/functions/admin-set-user-password/index.ts` แล้ว deploy function อีกครั้ง.

Edge Functions ตรวจ JWT ตามค่า `verify_jwt = true` ใน `supabase/config.toml`; Supabase CLI deploy function ที่ระบุได้ด้วยคำสั่งข้างต้น ([เอกสาร deploy](https://supabase.com/docs/guides/functions/deploy), [เอกสาร secrets](https://supabase.com/docs/guides/functions/secrets)).
