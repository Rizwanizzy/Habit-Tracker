import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { extractError } from './useHabits'
import type { Profile, ProfileInput } from '../lib/profile'
import { prepareAvatar } from '../lib/avatar'
import { now } from '../lib/clock'

const SIGNED_URL_TTL = 3600 // seconds
const REFRESH_BEFORE = 5 * 60 * 1000 // refresh 5 minutes before expiry

function toInput(profile: Profile | null): ProfileInput {
  return {
    full_name: profile?.full_name ?? null,
    date_of_birth: profile?.date_of_birth ?? null,
    gender: profile?.gender ?? null,
    nationality: profile?.nationality ?? null,
    country: profile?.country ?? null,
    address: profile?.address ?? null,
    phone: profile?.phone ?? null,
    avatar_path: profile?.avatar_path ?? null,
  }
}

export interface UseProfileResult {
  profile: Profile | null
  loading: boolean
  error: string | null
  saving: boolean
  uploading: boolean
  email: string | null
  emailConfirmed: boolean
  avatarUrl: string | null
  reload: () => Promise<void>
  save: (input: ProfileInput) => Promise<Profile>
  uploadAvatar: (file: File) => Promise<string>
  removeAvatar: () => Promise<void>
  refreshAvatarUrl: () => Promise<void>
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = null
    }
  }

  const loadSignedUrl = useCallback(async (path: string | null) => {
    clearTimer()
    if (!path) {
      setAvatarUrl(null)
      return
    }
    const sb = getSupabase()
    const { data, error: e } = await sb.storage.from('avatars').createSignedUrl(path, SIGNED_URL_TTL)
    if (e) throw e
    setAvatarUrl(data.signedUrl)
    refreshTimer.current = setTimeout(() => {
      void loadSignedUrl(path)
    }, SIGNED_URL_TTL * 1000 - REFRESH_BEFORE)
  }, [])

  const reload = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError) throw userError
      const user = userData.user
      if (!user) throw new Error('You must be signed in')
      setEmail(user.email ?? null)
      setEmailConfirmed(Boolean(user.email_confirmed_at))

      const { data, error: profileError } = await sb
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profileError) throw profileError
      const row = (data as Profile | null) ?? null
      setProfile(row)
      await loadSignedUrl(row?.avatar_path ?? null)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setLoading(false)
    }
  }, [loadSignedUrl])

  useEffect(() => {
    void reload()
    return () => clearTimer()
  }, [reload])

  const save = useCallback(
    async (input: ProfileInput) => {
      setError(null)
      setSaving(true)
      try {
        const sb = getSupabase()
        const { data: userData, error: userError } = await sb.auth.getUser()
        if (userError) throw userError
        const user = userData.user
        if (!user) throw new Error('You must be signed in')
        const payload = { ...input, user_id: user.id, updated_at: now().toISOString() }
        const { data, error: upsertError } = await sb
          .from('profiles')
          .upsert(payload, { onConflict: 'user_id' })
          .select('*')
          .single()
        if (upsertError) throw upsertError
        const row = data as Profile
        setProfile(row)
        await loadSignedUrl(row.avatar_path)
        return row
      } catch (e) {
        setError(extractError(e))
        throw e
      } finally {
        setSaving(false)
      }
    },
    [loadSignedUrl],
  )

  const uploadAvatar = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      try {
        const sb = getSupabase()
        const { data: userData, error: userError } = await sb.auth.getUser()
        if (userError) throw userError
        const user = userData.user
        if (!user) throw new Error('You must be signed in')
        const blob = await prepareAvatar(file)
        const path = `${user.id}/avatar.webp`
        const { error: uploadError } = await sb.storage
          .from('avatars')
          .upload(path, blob, { contentType: 'image/webp', upsert: true })
        if (uploadError) throw uploadError
        await save({ ...toInput(profile), avatar_path: path })
        return path
      } catch (e) {
        setError(extractError(e))
        throw e
      } finally {
        setUploading(false)
      }
    },
    [profile, save],
  )

  const removeAvatar = useCallback(async () => {
    setError(null)
    setUploading(true)
    try {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError) throw userError
      const user = userData.user
      if (!user) throw new Error('You must be signed in')
      const path = profile?.avatar_path ?? `${user.id}/avatar.webp`
      const { error: delError } = await sb.storage.from('avatars').remove([path])
      if (delError) throw delError
      await save({ ...toInput(profile), avatar_path: null })
    } catch (e) {
      setError(extractError(e))
      throw e
    } finally {
      setUploading(false)
    }
  }, [profile, save])

  const refreshAvatarUrl = useCallback(async () => {
    await loadSignedUrl(profile?.avatar_path ?? null)
  }, [profile, loadSignedUrl])

  return {
    profile,
    loading,
    error,
    saving,
    uploading,
    email,
    emailConfirmed,
    avatarUrl,
    reload,
    save,
    uploadAvatar,
    removeAvatar,
    refreshAvatarUrl,
  }
}
