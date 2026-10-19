import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://surasikongbua-blip.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  })

  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }

  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin')

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: 'โดเมนนี้ไม่ได้รับอนุญาต' }, 403, null)
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': origin || '',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'รองรับเฉพาะคำขอ POST' }, 405, origin)
  }

  const authorization = request.headers.get('Authorization') || ''
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i)
  if (!tokenMatch) return jsonResponse({ error: 'กรุณาเข้าสู่ระบบใหม่' }, 401, origin)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[admin-set-user-password] Missing Supabase environment configuration')
    return jsonResponse({ error: 'ระบบเปลี่ยนรหัสผ่านยังตั้งค่าไม่ครบ' }, 500, origin)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  })

  const { data: authData, error: authError } = await callerClient.auth.getUser(tokenMatch[1])
  if (authError || !authData.user) {
    return jsonResponse({ error: 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' }, 401, origin)
  }

  let payload: { targetUserId?: unknown; password?: unknown }
  try {
    const contentLength = Number(request.headers.get('Content-Length') || 0)
    if (contentLength > 16_384) return jsonResponse({ error: 'ข้อมูลคำขอมีขนาดใหญ่เกินไป' }, 413, origin)
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400, origin)
  }

  const targetUserId = payload?.targetUserId
  const password = payload?.password
  if (typeof targetUserId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return jsonResponse({ error: 'ไม่พบผู้ใช้เป้าหมาย' }, 400, origin)
  }
  if (typeof password !== 'string' || Array.from(password).length < 8 || password.trim().length === 0) {
    return jsonResponse({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400, origin)
  }
  if (Array.from(password).length > 128 || new TextEncoder().encode(password).byteLength > 512) {
    return jsonResponse({ error: 'รหัสผ่านยาวเกินไป (สูงสุด 128 ตัวอักษร)' }, 400, origin)
  }

  // Reuse the database's existing admin-only RPC as the source of truth for app roles.
  const { data: profileRows, error: profileError } = await callerClient.rpc('admin_get_profiles')
  if (profileError || !Array.isArray(profileRows)) {
    console.error('[admin-set-user-password] Admin profile lookup failed', profileError?.message || 'Invalid response')
    return jsonResponse({ error: 'ตรวจสอบสิทธิ์ Admin ไม่สำเร็จ' }, 403, origin)
  }

  const profiles = profileRows as Array<{ id?: string; role?: string; is_approved?: boolean }>
  const callerProfile = profiles.find(profile => profile.id === authData.user.id)
  if (callerProfile?.role !== 'admin' || callerProfile.is_approved !== true) {
    return jsonResponse({ error: 'เฉพาะ Admin ที่อนุมัติแล้วเท่านั้นที่เปลี่ยนรหัสผ่านได้' }, 403, origin)
  }
  if (!profiles.some(profile => profile.id === targetUserId)) {
    return jsonResponse({ error: 'ไม่พบผู้ใช้เป้าหมายในระบบ' }, 404, origin)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password })
  if (updateError) {
    console.error('[admin-set-user-password] Auth password update failed', updateError.message)
    return jsonResponse({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจเงื่อนไขรหัสผ่านของ Supabase Auth' }, 400, origin)
  }

  return jsonResponse({ success: true }, 200, origin)
})
