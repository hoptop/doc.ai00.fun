/**
 * 从 notebook 目录同步 Markdown 文件到 Supabase course_pages 表
 * 同时上传图片和文件到 Supabase Storage，并改写 Markdown 中的引用路径
 * 
 * 使用方法:
 * 1. 在项目根目录创建 .env.local 文件，添加:
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *    SUPABASE_STORAGE_BUCKET=course-assets  (可选，默认 course-assets)
 * 
 * 2. 在 Supabase Dashboard 创建公开 bucket (名称与上面一致)
 * 
 * 3. 将课程 Markdown 放入 notebook/ 目录
 *    - 图片放入 notebook/image/
 *    - 附件放入 notebook/file/
 * 
 * 4. 运行: npm run sync:markdown
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
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'course-assets'

// 显示环境变量信息
console.log('📋 环境变量配置:')
console.log(`   📁 环境文件: ${envPath}`)
console.log(`   🌐 Supabase URL: ${SUPABASE_URL}`)
console.log(`   📦 Storage Bucket: ${STORAGE_BUCKET}`)

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

// 已上传资源的缓存（避免重复上传）
const uploadedAssets = new Map()

// 根据文件扩展名获取 MIME 类型
const getMimeType = (filePath) => {
  const ext = extname(filePath).toLowerCase()
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.tar': 'application/x-tar',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// 上传单个资源到 Storage
const uploadAsset = async (localPath, storagePath) => {
  // 检查缓存
  if (uploadedAssets.has(storagePath)) {
    return uploadedAssets.get(storagePath)
  }

  if (!existsSync(localPath)) {
    console.warn(`   ⚠️  文件不存在: ${localPath}`)
    return null
  }

  try {
    const fileBuffer = readFileSync(localPath)
    const mimeType = getMimeType(localPath)

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      })

    if (error) {
      throw error
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl
    uploadedAssets.set(storagePath, publicUrl)
    
    console.log(`   📤 上传: ${storagePath}`)
    return publicUrl

  } catch (err) {
    console.error(`   ❌ 上传失败 "${storagePath}": ${err.message}`)
    return null
  }
}

// 处理 Markdown 中的资源引用，上传并替换为公开 URL
const processMarkdownContent = async (content, notebookDir) => {
  let processedContent = content
  
  // 匹配图片: ![alt](image/xxx.png) 或 ![alt](image/xxx.png "title")
  const imageRegex = /!\[([^\]]*)\]\((image\/[^)\s]+)(?:\s+"[^"]*")?\)/g
  
  // 匹配文件链接: [text](file/xxx.gz) 或 [text](file/xxx.gz "title")
  const fileRegex = /\[([^\]]*)\]\((file\/[^)\s]+)(?:\s+"[^"]*")?\)/g
  
  // 收集所有需要处理的资源
  const assets = []
  
  // 查找图片
  let match
  while ((match = imageRegex.exec(content)) !== null) {
    assets.push({
      fullMatch: match[0],
      altOrText: match[1],
      relativePath: match[2],
      type: 'image'
    })
  }
  
  // 查找文件
  while ((match = fileRegex.exec(content)) !== null) {
    assets.push({
      fullMatch: match[0],
      altOrText: match[1],
      relativePath: match[2],
      type: 'file'
    })
  }
  
  if (assets.length === 0) {
    return processedContent
  }
  
  console.log(`   🔍 发现 ${assets.length} 个资源引用`)
  
  // 上传并替换
  for (const asset of assets) {
    const localPath = join(notebookDir, asset.relativePath)
    // Storage 路径保持原结构：image/xxx.png 或 file/xxx.gz
    const storagePath = asset.relativePath
    
    const publicUrl = await uploadAsset(localPath, storagePath)
    
    if (publicUrl) {
      // 构建新的 Markdown 引用
      let newRef
      if (asset.type === 'image') {
        newRef = `![${asset.altOrText}](${publicUrl})`
      } else {
        newRef = `[${asset.altOrText}](${publicUrl})`
      }
      
      processedContent = processedContent.replace(asset.fullMatch, newRef)
    }
  }
  
  return processedContent
}

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

// 同步单个文件
const syncFile = async (file, index, notebookDir) => {
  const { path: filePath, relativePath, name } = file
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const slug = generateSlug(name)
    const title = name // 保留完整文件名作为标题
    const sortOrder = extractSortOrder(name, index)
    
    // 处理 Markdown 内容：上传资源并替换路径
    const processedContent = await processMarkdownContent(content, notebookDir)
    
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
  
  // 检查 bucket 是否存在
  console.log(`\n🔍 检查 Storage bucket "${STORAGE_BUCKET}"...`)
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
  
  if (bucketsError) {
    console.error(`❌ 无法获取 bucket 列表: ${bucketsError.message}`)
    process.exit(1)
  }
  
  const bucketExists = buckets.some(b => b.name === STORAGE_BUCKET)
  if (!bucketExists) {
    console.error(`❌ Bucket "${STORAGE_BUCKET}" 不存在！`)
    console.error('   请先在 Supabase Dashboard > Storage 创建一个公开的 bucket')
    console.error(`   Bucket 名称: ${STORAGE_BUCKET}`)
    console.error('   Public: ✅ 勾选')
    process.exit(1)
  }
  console.log(`   ✅ Bucket "${STORAGE_BUCKET}" 已就绪\n`)
  
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
    const result = await syncFile(files[i], i, notebookDir)
    if (result.success) {
      success++
    } else {
      failed++
    }
  }
  
  console.log('\n📊 同步完成:')
  console.log(`   ✅ 成功: ${success}`)
  console.log(`   ❌ 失败: ${failed}`)
  console.log(`   📤 已上传资源: ${uploadedAssets.size} 个`)
}

main().catch(console.error)
