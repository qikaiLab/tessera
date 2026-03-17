import React, { useState } from 'react'
import './Onboarding.css'

const steps = [
  {
    icon: '◈',
    title: '欢迎使用 MotoTrace',
    desc: '一款专为自我记录设计的桌面应用。你可以追踪日记、运动、学习、心情等任何你想记录的事物。'
  },
  {
    icon: '◎',
    title: '今日记录',
    desc: '每天打开软件，在「今日记录」页面记录你的数据。支持文字和数字两种类型，自动实时保存。'
  },
  {
    icon: '⊞',
    title: '自定义数据版块',
    desc: '在「设置」页面可以自由添加、删除、排序你的数据版块。设置为「常驻」的版块每天都会显示，其余版块在有记录时自动出现。'
  },
  {
    icon: '∑',
    title: '数据分析',
    desc: '在「数据分析」页面，你可以创建自定义图表，通过折线图、柱状图、热力图等方式可视化你的记录数据。'
  }
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1
  const current = steps[step]

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-dots">
          {steps.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} onClick={() => setStep(i)} />
          ))}
        </div>
        <div className="onboarding-icon" key={step}>{current.icon}</div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.desc}</p>
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
              上一步
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          >
            {isLast ? '开始使用' : '下一步'}
          </button>
        </div>
        <button className="onboarding-skip" onClick={onDone}>跳过</button>
      </div>
    </div>
  )
}
