import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 课程列表项（不含 md_content）
interface CourseListItem {
  id: number
  slug: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

function Course() {
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('course_pages')
        .select('id, slug, title, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCourses(data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
      setError('加载课程列表失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="course-loading">
        <div className="loading-spinner"></div>
        <p>加载课程中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="course-error">
        <p>{error}</p>
        <button onClick={fetchCourses}>重试</button>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="course-empty">
        <div className="empty-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <h3>暂无课程</h3>
        <p>课程正在准备中，敬请期待</p>
      </div>
    )
  }

  return (
    <div className="course-container">
      <div className="course-header">
        <h2>课程列表</h2>
        <p>共 {courses.length} 节课程</p>
      </div>

      <div className="course-grid">
        {courses.map((course, index) => (
          <Link
            key={course.id}
            to={`/courses/${course.slug}`}
            className="course-card"
          >
            <div className="course-number">{String(index + 1).padStart(2, '0')}</div>
            <h3 className="course-title">{course.title}</h3>
            <div className="course-meta">
              <span>更新于 {new Date(course.updated_at).toLocaleDateString('zh-CN')}</span>
            </div>
            <div className="course-arrow">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Course
