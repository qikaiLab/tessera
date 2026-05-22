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
    desc: '在「今日记录」页面记录你的数据。支持文字和数字两种类型，自动实时保存。只要将非必填版块的所有内容清空，刷新后它就会自动隐藏，保持界面清爽。'
  },
  {
    icon: '⌨',
    title: '快捷键与 Markdown',
    desc: '文本版块支持 Markdown 实时预览。输入「/」可快速调出快捷菜单插入表格或列表；使用「Ctrl + S」可手动触发保存；在列表或引用块内按「Ctrl + Enter」可快速退出当前块并新建段落。'
  },
  {
    icon: '⊞',
    title: '自定义数据版块',
    desc: '在「设置」页面可以自由添加、删除、排序你的数据版块，并为它们设定专属的颜色。设置为「常驻」的版块每天都会固定显示在最前方。'
  },
  {
    icon: '∑',
    title: '数据分析',
    desc: '在「数据分析」页面创建自定义图表。折线图与柱状图支持多数据的双 Y 轴对比；热力图支持按星期呈现一整年的频率，颜色会严格跟随你在设置中定义的主题色。'
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
