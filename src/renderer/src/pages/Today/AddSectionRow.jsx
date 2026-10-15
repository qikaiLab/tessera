// "Add record": the optional sections that are not on this day yet. Adding one only puts it on
// screen; nothing is stored until the user writes or enters something in it.
export default function AddSectionRow({ sections, onAdd }) {
  if (sections.length === 0) return null
  return (
    <div className="today-add-section">
      <span className="add-section-label">添加记录</span>
      <div className="add-section-list">
        {sections.map(section => (
          <button key={section.id} className="add-section-btn" onClick={() => onAdd(section.id)}>
            + {section.name}
          </button>
        ))}
      </div>
    </div>
  )
}
