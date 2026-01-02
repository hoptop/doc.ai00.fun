import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, CoursePage } from '../lib/supabase'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

function CourseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<CoursePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      fetchCourse(slug)
    }
  }, [slug])

  const fetchCourse = async (courseSlug: string) => {
    try {
      const { data, error } = await supabase
        .from('course_pages')
        .select('*')
        .eq('slug', courseSlug)
        .single()

      if (error) throw error
      setCourse(data)
    } catch (err) {
      console.error('Error fetching course:', err)
      setError('课程不存在或加载失败')
    } finally {
      setLoading(false)
    }
  }

  const renderMarkdown = (content: string): string => {
    const rawHtml = marked.parse(content, { async: false }) as string
    return DOMPurify.sanitize(rawHtml)
  }

  if (loading) {
    return (
      <div className="course-loading">
        <div className="loading-spinner"></div>
        <p>加载课程内容...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="course-error">
        <p>{error || '课程不存在'}</p>
        <Link to="/courses" className="back-link">
          返回课程列表
        </Link>
      </div>
    )
  }

  return (
    <div className="course-detail">
      <div className="course-detail-header">
        <Link to="/courses" className="back-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回列表
        </Link>
        <h1>{course.title}</h1>
        <div className="course-detail-meta">
          <span>最后更新: {new Date(course.updated_at).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>

      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(course.md_content) }}
      />
    </div>
  )
}

export default CourseDetail
