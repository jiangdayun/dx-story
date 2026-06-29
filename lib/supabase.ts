import { createClient } from '@supabase/supabase-js'

// 正式模式：使用 Supabase 进行登录和数据存储
const isDemoMode = false

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo_key'

// 前端客户端使用公开匿名密钥，真实权限由 Supabase RLS 控制
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isDemo = isDemoMode
