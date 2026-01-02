interface PendingProps {
  username?: string
  onLogout: () => void
}

function Pending({ username, onLogout }: PendingProps) {
  return (
    <div className="pending-container">
      <div className="pending-card">
        <div className="pending-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2>等待激活</h2>

        <p className="pending-message">
          您好，<strong>@{username}</strong>！
        </p>

        <p className="pending-description">
          您的账号已注册成功，但需要管理员审核激活后才能访问课程内容。
          请耐心等待，或联系管理员加速处理。
        </p>

        <div className="pending-tips">
          <h4>温馨提示</h4>
          <ul>
            <li>激活通常需要 1-2 个工作日</li>
            <li>激活后刷新页面即可进入</li>
            <li>如有疑问请联系管理员</li>
          </ul>
        </div>

        <button onClick={onLogout} className="logout-link">
          退出登录
        </button>
      </div>
    </div>
  )
}

export default Pending
