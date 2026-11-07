/**
 * Habit Tracker — Pass 3 daily-reminder push sender (Cloudflare Worker).
 *
 * Cron (every 15 min): read `notification_settings` (enabled) via the
 * service-role key, pick users whose reminder time falls in the CURRENT
 * 15-minute window IN THEIR OWN timezone, encrypt a reminder with RFC 8291
 * (aes128gcm) per subscription, and POST it to the push service. Dead
 * endpoints (404/406/410) are deleted from push_subscriptions.
 *
 * Local testing:
 *   npx wrangler dev -c worker/wrangler.toml
 *   -> GET http://localhost:8787/cdn-cgi/handler/scheduled?cron=*%2F15+*+*+*+* (cron tick — wrangler 4)
 *   -> GET http://localhost:8787/send-test?token=<TEST_TOKEN>      (send now)
 *      &user=<user_id> limits to one account; &tz=Asia/Kolkata overrides tz.
 *
 * Secrets (wrangler secret put): VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * TEST_TOKEN. Vars: SUPABASE_URL, VAPID_PUBLIC_KEY, VAPID_SUBJECT (optional).
 */

import { vapidAuthorization, type VapidKeys } from './vapid'
import { encryptPushPayload } from './encrypt'

export interface Env {
  SUPABASE_URL: string
  /** SECRET — bypasses RLS; server-side only, never in the frontend. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Vars — the same public key the frontend used to subscribe. */
  VAPID_PUBLIC_KEY: string
  /** SECRET — the private twin. */
  VAPID_PRIVATE_KEY: string
  /** Optional var, e.g. "mailto:you@example.com". */
  VAPID_SUBJECT?: string
  /** SECRET — guards the /send-test route. */
  TEST_TOKEN: string
}

interface ReminderSettings {
  user_id: string
  reminder_time: string
  timezone: string
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
}

const WINDOW_MINUTES = 15 /** must keep matching the cron frequency */
const DEFAULT_TZ = 'Asia/Kolkata'
const SUBJECT = 'mailto:reminders@habbits-tracker.pages.dev'

export default {
  async scheduled(_event: unknown, env: Env, _ctx: ExecutionContext): Promise<void> {
    await sendDueReminders(env)
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/send-test') {
      const token = url.searchParams.get('token')
      if (!env.TEST_TOKEN || token !== env.TEST_TOKEN) {
        return Response.json({ ok: false, error: 'Invalid or missing token' }, { status: 401 })
      }
      const result = await sendReminders(env, {
        ignoreTime: true,
        userId: url.searchParams.get('user') ?? undefined,
        timezoneOverride: url.searchParams.get('tz') ?? undefined,
      })
      return Response.json({ ok: true, ...result })
    }
    return new Response(
      'Habit Tracker push sender (Pass 3). ' +
        'GET /cdn-cgi/handler/scheduled?cron=*/15+*+*+*+* runs the cron tick; ' +
        'GET /send-test?token=<TEST_TOKEN> sends a real push to every enabled account now.',
    )
  },
}

// ---------------------------------------------------------------------------
// Queries (Supabase REST with the service-role key; RLS is bypassed here
// BY DESIGN server-side — the frontend rule stands untouched).
// ---------------------------------------------------------------------------

async function restQuery(env: Env, table: string, query: string): Promise<unknown[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase ${table} query failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<unknown[]>
}

async function deleteDeadSubscription(env: Env, endpoint: string): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  })
}

// ---------------------------------------------------------------------------
// Due-time matching
// ---------------------------------------------------------------------------

function hhmmInZone(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  } catch {
    return hhmmInZone(DEFAULT_TZ, now)
  }
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Due when `now` falls inside [reminderTime, reminderTime + 15 min). */
export function isDue(nowHHMM: string, reminderHHMM: string | undefined): boolean {
  if (!reminderHHMM) return false
  const now = toMinutes(nowHHMM)
  const due = toMinutes(reminderHHMM)
  if (now === null || due === null) return false
  return now >= due && now < due + WINDOW_MINUTES
}

// ---------------------------------------------------------------------------
// Push delivery
// ---------------------------------------------------------------------------

function reminderPayload(): Record<string, string | boolean> {
  return {
    title: 'Habit Tracker',
    body: 'Time to check in on your habits for today!',
    tag: 'daily-reminder',
    renotify: true,
    url: '/',
  }
}

interface SendResult {
  sent: number
  gone: number
  failed: number
  matched: number
}

async function sendToSubscription(
  env: Env,
  keys: VapidKeys,
  sub: PushSubscription,
  payload: string,
): Promise<'sent' | 'gone' | 'error'> {
  try {
    const endpointOrigin = new URL(sub.endpoint).origin
    const authorization = await vapidAuthorization(keys, endpointOrigin, SUBJECT)
    const body = await encryptPushPayload(payload, { p256dh: sub.p256dh, auth: sub.auth })
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '60',
        Urgency: 'normal',
      },
      body,
    })
    // 404: expired endpoint; 406: bad VAPID/aes128gcm (warned, not deleted);
    // 410: subscription revoked by the user agent.
    if (res.status === 404 || res.status === 410) {
      return 'gone'
    }
    if (!res.ok) {
      console.error(`[push] ${res.status} for ${sub.endpoint.slice(0, 60)}: ${await res.text()}`)
      return 'error'
    }
    return 'sent'
  } catch (err) {
    console.error('[push] send threw:', err instanceof Error ? err.message : err)
    return 'error'
  }
}

async function sendReminders(
  env: Env,
  opts: { ignoreTime?: boolean; userId?: string; timezoneOverride?: string } = {},
): Promise<SendResult> {
  if (!env.SUPABASE_URL || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('Missing SUPABASE_URL / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY')
  }
  const keys: VapidKeys = { public: env.VAPID_PUBLIC_KEY, private: env.VAPID_PRIVATE_KEY }

  const settings = (await restQuery(
    env,
    'notification_settings',
    'select=user_id,reminder_time,timezone&reminder_enabled=eq.true' +
      (opts.userId ? `&user_id=eq.${opts.userId}` : ''),
  )) as ReminderSettings[]

  const payload = JSON.stringify(reminderPayload())
  const result: SendResult = { sent: 0, gone: 0, failed: 0, matched: 0 }

  for (const s of settings) {
    const tz = opts.timezoneOverride ?? s.timezone
    const due = opts.ignoreTime === true || isDue(hhmmInZone(tz), s.reminder_time)
    if (!due) continue
    result.matched++

    const subs = (
      await restQuery(env, 'push_subscriptions', `select=endpoint,p256dh,auth,user_id&user_id=eq.${s.user_id}`)
    ) as PushSubscription[]
    if (subs.length === 0) continue

    for (const sub of subs) {
      const outcome = await sendToSubscription(env, keys, sub, payload)
      if (outcome === 'sent') result.sent++
      else if (outcome === 'gone') {
        result.gone++
        await deleteDeadSubscription(env, sub.endpoint)
      } else result.failed++
    }
  }
  return result
}

async function sendDueReminders(env: Env): Promise<void> {
  try {
    const r = await sendReminders(env)
    console.log(`[cron] matched=${r.matched} sent=${r.sent} gone=${r.gone} failed=${r.failed}`)
  } catch (err) {
    console.error('[cron] failed:', err instanceof Error ? err.message : err)
  }
}
