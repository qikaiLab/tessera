import { useMemo } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useApp } from '../../context/AppContext'
import ModalFrame from '../../components/ModalFrame'
import Presence from '../../components/Presence'
import SortableCard from './AnalyticsCard'
import { SECONDARY_PALETTE, getRenderedAccentColor } from './chartTheme'
import { useAnalyticsCards } from './useAnalyticsCards'
import { useAnalyticsDays } from './useAnalyticsDays'
import './Analytics.css'

function DeleteChartDialog({ card, onCancel, onConfirm }) {
  return (
    <Presence>{card && (
      <ModalFrame role="alertdialog" label="删除图表" onDismiss={onCancel} style={{ maxWidth: 380 }}>
          <div className="modal-header">
            <span className="modal-title">删除图表</span>
            <button className="btn btn-ghost btn-icon" aria-label="关闭" onClick={onCancel}>✕</button>
          </div>
          <div style={{ marginBottom: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>确定要删除图表 <b>「{card.title}」</b> 吗？</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>此操作无法撤销。</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" data-autofocus="" onClick={onCancel}>取消</button>
            <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={onConfirm}>确定删除</button>
          </div>
      </ModalFrame>
    )}</Presence>
  )
}

// The analytics page: a grid of chart cards (line, bar, pie, heatmap) bound to data sections.
export default function Analytics() {
  const { sections, datesWithData, analytics: cards, saveAnalytics: setCards } = useApp()
  const { loadedData, loading } = useAnalyticsDays(datesWithData)
  const cardActions = useAnalyticsCards({ cards, setCards })
  const accentColor = getRenderedAccentColor()
  const palette = useMemo(() => [accentColor, ...SECONDARY_PALETTE], [accentColor])

  const sensors = useSensors(
    // A plain click on the handle must not start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <div className="analytics-page">
      <div className="page-header">
        <span className="page-title">数据分析</span>
        <button className="btn btn-primary btn-sm" onClick={cardActions.addCard}>⊕ 新建图表</button>
      </div>
      <div className="page-content analytics-content">
        {cards.length === 0 ? (
          <div className="empty-state" style={{ height: '70%' }}>
            <span className="empty-state-icon">∑</span>
            <p className="empty-state-title">还没有图表</p>
            <p className="empty-state-desc">点击「新建图表」创建你的第一个数据可视化卡片</p>
            <button className="btn btn-primary" onClick={cardActions.addCard}>创建图表</button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={cardActions.handleDragEnd}>
            <SortableContext items={cards.map(card => card.id)} strategy={rectSortingStrategy}>
              <div className="analytics-grid">
                {cards.map(card => (
                  <SortableCard
                    key={card.id}
                    id={`analytics-card-${card.id}`}
                    card={card}
                    sections={sections}
                    loadedData={loadedData}
                    loading={loading}
                    datesWithData={datesWithData}
                    palette={palette}
                    isEditing={cardActions.editingCard === card.id}
                    onEdit={() => cardActions.toggleEditing(card.id)}
                    onUpdate={(updates) => cardActions.updateCard(card.id, updates)}
                    onDelete={() => cardActions.requestDelete(card.id)}
                    onDuplicate={() => cardActions.duplicateCard(card.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <DeleteChartDialog
        card={cards.find(card => card.id === cardActions.pendingDelete)}
        onCancel={cardActions.cancelDelete}
        onConfirm={cardActions.confirmDelete}
      />
    </div>
  )
}
