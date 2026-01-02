/**
 * 从 notebook 目录同步 Markdown 文件到 Supabase course_pages 表
 * 
 * 使用方法:
 * 1. 在项目根目录创建 .env.local 文件，添加:
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 * 
 * 2. 将课程 Markdown 放入 notebook/ 目录
 * 
 * 3. 运行: npm run sync:markdown
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { config } from 'dotenv'
import { resolve, dirname, basename, extname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// 加载环境变量
const envPath = resolve(rootDir, '.env.local')
config({ path: envPath })

const SUPABASE_URL = 'https://lohrzoxpussniseyctjb.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 显示环境变量信息
console.log('📋 环境变量配置:')
console.log(`   📁 环境文件: ${envPath}`)
console.log(`   🌐 Supabase URL: ${SUPABASE_URL}`)

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 请在 .env.local 中设置 SUPABASE_SERVICE_ROLE_KEY')
  console.error('   可以在 Supabase 项目设置 > API > service_role 中找到')
  process.exit(1)
}

// 显示密钥的部分内容以便确认（显示前8个和后8个字符）
const keyPreview = SERVICE_ROLE_KEY.length > 16 
  ? `${SERVICE_ROLE_KEY.substring(0, 8)}...${SERVICE_ROLE_KEY.substring(SERVICE_ROLE_KEY.length - 8)}`
  : `${SERVICE_ROLE_KEY.substring(0, 4)}...${SERVICE_ROLE_KEY.substring(SERVICE_ROLE_KEY.length - 4)}`
console.log(`   🔑 Service Role Key: ${keyPreview} (长度: ${SERVICE_ROLE_KEY.length})`)
console.log('')

// 使用 Service Role Key 创建管理员客户端
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 递归扫描 Markdown 文件
const scanMarkdownFiles = (dir, basePath = '') => {
  const files = []
  
  if (!existsSync(dir)) {
    return files
  }
  
  const entries = readdirSync(dir)
  
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relativePath = basePath ? `${basePath}/${entry}` : entry
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      // 跳过 image 和 file 目录
      if (entry === 'image' || entry === 'file') continue
      files.push(...scanMarkdownFiles(fullPath, relativePath))
    } else if (extname(entry).toLowerCase() === '.md') {
      files.push({
        path: fullPath,
        relativePath,
        name: basename(entry, '.md')
      })
    }
  }
  
  return files
}

// 从文件名生成 slug
const generateSlug = (name) => {
  // 移除可能的序号前缀 (如 "第一课- " 或 "01- ")
  let slug = name
    .replace(/^第[一二三四五六七八九十百千万]+课[-:：\s]*/i, '')
    .replace(/^\d+[-:：.\s]*/i, '')
    .trim()
  
  // 转换为 URL 友好格式
  slug = slug
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
  
  // 如果 slug 为空，使用原名
  if (!slug) {
    slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
  }
  
  return slug || 'untitled'
}

// 从文件名提取排序号
const extractSortOrder = (name, index) => {
  // 尝试从 "第N课" 格式提取
  const chineseMatch = name.match(/^第([一二三四五六七八九十百千万]+)课/i)
  if (chineseMatch) {
    const chineseNums = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
    const numStr = chineseMatch[1]
    if (chineseNums[numStr]) {
      return chineseNums[numStr]
    }
  }
  
  // 尝试从数字前缀提取
  const numMatch = name.match(/^(\d+)/)
  if (numMatch) {
    return parseInt(numMatch[1], 10)
  }
  
  // 使用文件索引
  return index + 1
}

// 从文件名提取标题
const extractTitle = (name) => {
  // 移除常见前缀格式，保留主标题
  let title = name
    .replace(/^第[一二三四五六七八九十百千万]+课[-:：\s]*/i, '')
    .replace(/^\d+[-:：.\s]*/i, '')
    .trim()
  
  // 如果处理后为空，返回原名
  return title || name
}

// 处理 Markdown 中的图片路径
// 由于图片存储在 notebook/image 目录，且内容现在在 DB 中
// 需要考虑如何处理图片（这里暂时保留原始路径，建议后续迁移到 Supabase Storage）
const processMarkdownContent = (content, relativePath) => {
  // 保持原样，后续如果需要可以替换图片路径
  // 例如迁移到 Supabase Storage 后替换为公开 URL
  return content
}

// 同步单个文件
const syncFile = async (file, index) => {
  const { path: filePath, relativePath, name } = file
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const slug = generateSlug(name)
    const title = name // 保留完整文件名作为标题
    const sortOrder = extractSortOrder(name, index)
    const processedContent = processMarkdownContent(content, relativePath)
    
    // Upsert 到数据库
    const { error } = await supabase
      .from('course_pages')
      .upsert({
        slug,
        title,
        sort_order: sortOrder,
        md_content: processedContent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'slug'
      })

    if (error) throw error

    console.log(`✅ 同步: ${name}`)
    console.log(`   slug: ${slug}, order: ${sortOrder}`)
    return { success: true }

  } catch (err) {
    console.error(`❌ 同步失败 "${name}": ${err.message}`)
    return { success: false, error: err.message }
  }
}

// 主函数
const main = async () => {
  const notebookDir = resolve(rootDir, 'notebook')
  
  console.log('🚀 开始同步 Markdown 到 Supabase...\n')
  console.log(`📂 源目录: ${notebookDir}`)
  
  const files = scanMarkdownFiles(notebookDir)
  
  if (files.length === 0) {
    console.log('\n⚠️  没有找到 Markdown 文件')
    return
  }
  
  // 按文件名排序
  files.sort((a, b) => {
    const orderA = extractSortOrder(a.name, 0)
    const orderB = extractSortOrder(b.name, 0)
    return orderA - orderB
  })
  
  console.log(`📋 共找到 ${files.length} 个 Markdown 文件\n`)
  
  let success = 0
  let failed = 0
  
  for (let i = 0; i < files.length; i++) {
    const result = await syncFile(files[i], i)
    if (result.success) {
      success++
    } else {
      failed++
    }
  }
  
  console.log('\n📊 同步完成:')
  console.log(`   ✅ 成功: ${success}`)
  console.log(`   ❌ 失败: ${failed}`)
  
  if (success > 0) {
    console.log('\n💡 提示: 图片目前保留原始相对路径')
    console.log('   如需在线显示图片，请将 notebook/image 目录上传到 Supabase Storage')
    console.log('   或部署到 GitHub Pages 后通过公开 URL 访问')
  }
}

main().catch(console.error)
