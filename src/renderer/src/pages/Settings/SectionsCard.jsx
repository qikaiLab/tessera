import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useApp } from '../../context/AppContext'
import { normalizeNumberDefaultMode } from '../../utils/sectionDefaults'
import AddSectionForm from './AddSectionForm'
import SortableSection from './SortableSection'
import './SectionsCard.css'

// Managing the data sections: order (drag), rename, colour, resident, default mode, add, delete.
export default function SectionsCard({ hidden, onRequestDelete }) {
  const { sections, saveSections, showToast } = useApp()

  const sensors = useSensors(
    // A plain click on the handle must not start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async ({ active, over }) => {
    // Dropping outside every row leaves `over` empty: nothing to reorder.
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    await saveSections(arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, order: i })))
  }

  const updateSection = (id, patch) => saveSections(sections.map(s => (s.id === id ? { ...s, ...patch } : s)))

  const addSection = async (section) => {
    await saveSections([...sections, section])
    showToast('已添加新数据版块', 'success')
  }

  const renameSection = async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    await updateSection(id, { name: trimmed })
    showToast('已重命名版块', 'success')
  }

  const changeNumberDefaultMode = (id, mode) => {
    const target = sections.find(s => s.id === id)
    if (target?.type === 'number') return updateSection(id, { numberDefaultMode: normalizeNumberDefaultMode(mode) })
    return undefined
  }

  return (
    <div className="settings-card" hidden={hidden}>
      <div className="settings-card-title">数据版块管理</div>
      <div className="settings-card-desc">自由添加、删除和排序您的记录版块。设置为常驻的版块每天都会固定显示在最前方。<br/>拖拽左侧的 ☷ 图标可以排序。</div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="section-list">
            {sections.map(sec => (
              <SortableSection
                key={sec.id}
                section={sec}
                onToggleResident={() => updateSection(sec.id, { resident: !sec.resident })}
                onChangeColor={(color) => updateSection(sec.id, { color })}
                onRename={(name) => renameSection(sec.id, name)}
                onChangeNumberDefaultMode={(mode) => changeNumberDefaultMode(sec.id, mode)}
                onDelete={() => onRequestDelete(sec.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddSectionForm nextOrder={sections.length} onAdd={addSection} />
    </div>
  )
}
