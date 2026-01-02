/**
 * 从 account.txt 批量导入用户到 Supabase
 * 
 * 使用方法:
 * 1. 在项目根目录创建 .env.local 文件，添加:
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 * 
 * 2. 创建 account.txt 文件，每行一个用户:
 *    username1 password1
 *    username2 password2
 * 
 * 3. 运行: npm run import:accounts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// 加载环境变量
config({ path: resolve(rootDir, '.env.local') })

const SUPABASE_URL = 'https://jwzriogbwnvbigbpzysc.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 请在 .env.local 中设置 SUPABASE_SERVICE_ROLE_KEY')
  console.error('   可以在 Supabase 项目设置 > API > service_role 中找到')
  process.exit(1)
}

// 使用 Service Role Key 创建管理员客户端
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 将用户名映射为伪邮箱
const usernameToEmail = (username) => {
  return `${username.toLowerCase().trim()}@gzdlab.com`
}

// 解析 account.txt
const parseAccountFile = (filePath) => {
  if (!existsSync(filePath)) {
    console.error(`❌ 错误: 找不到账号文件 ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  
  const accounts = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    
    // 支持空格、Tab、逗号分隔
    const parts = line.split(/[\s,]+/).filter(Boolean)
    
    if (parts.length < 2) {
      console.warn(`⚠️  跳过第 ${i + 1} 行: 格式不正确 (需要: 用户名 密码)`)
      continue
    }
    
    const [username, password] = parts
    
    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.warn(`⚠️  跳过用户 "${username}": 用户名只能包含字母、数字和下划线`)
      continue
    }
    
    if (password.length < 6) {
      console.warn(`⚠️  跳过用户 "${username}": 密码至少需要6个字符`)
      continue
    }
    
    accounts.push({ username: username.toLowerCase(), password })
  }
  
  return accounts
}

// 创建单个用户
const createUser = async (username, password, isActive = true) => {
  const email = usernameToEmail(username)
  
  try {
    // 使用 Admin API 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        username
      }
    })

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`⏭️  用户 "${username}" 已存在，跳过`)
        return { success: false, reason: 'exists' }
      }
      throw error
    }

    // 如果需要预激活用户，更新 profiles 表
    if (isActive && data.user) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', data.user.id)

      if (updateError) {
        console.warn(`⚠️  用户 "${username}" 创建成功，但激活失败: ${updateError.message}`)
      }
    }

    console.log(`✅ 创建用户: ${username}${isActive ? ' (已激活)' : ''}`)
    return { success: true, user: data.user }

  } catch (err) {
    console.error(`❌ 创建用户 "${username}" 失败: ${err.message}`)
    return { success: false, reason: err.message }
  }
}

// 主函数
const main = async () => {
  const accountFile = resolve(rootDir, 'account.txt')
  
  console.log('🚀 开始导入用户账号...\n')
  console.log(`📂 账号文件: ${accountFile}`)
  
  const accounts = parseAccountFile(accountFile)
  
  if (accounts.length === 0) {
    console.log('\n⚠️  没有找到有效的账号')
    return
  }
  
  console.log(`📋 共找到 ${accounts.length} 个有效账号\n`)
  
  let created = 0
  let skipped = 0
  let failed = 0
  
  for (const { username, password } of accounts) {
    const result = await createUser(username, password, true)
    
    if (result.success) {
      created++
    } else if (result.reason === 'exists') {
      skipped++
    } else {
      failed++
    }
    
    // 稍微延迟，避免 rate limiting
    await new Promise(r => setTimeout(r, 100))
  }
  
  console.log('\n📊 导入完成:')
  console.log(`   ✅ 新建: ${created}`)
  console.log(`   ⏭️  跳过: ${skipped}`)
  console.log(`   ❌ 失败: ${failed}`)
}

main().catch(console.error)
