import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwzriogbwnvbigbpzysc.supabase.co'
const supabaseAnonKey = 'sb_publishable_L2Hb_V8AgSfOLdNLRJDY9w_UWezlHzz'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 将用户名映射为伪邮箱
export const usernameToEmail = (username: string): string => {
  return `${username.toLowerCase().trim()}@local.invalid`
}

// 从伪邮箱提取用户名
export const emailToUsername = (email: string): string => {
  return email.replace('@local.invalid', '')
}

// 类型定义
export interface Profile {
  id: string
  username: string
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface CoursePage {
  id: number
  slug: string
  title: string
  sort_order: number
  md_content: string
  created_at: string
  updated_at: string
}
