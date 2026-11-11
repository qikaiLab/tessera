import FavoriteButton from './FavoriteButton'
import NumberInput from './NumberInput'
import SectionTypeBadge from './SectionTypeBadge'

// A number section: one slim bar with its name, tags and the stepper.
export default function NumberCard({
  section,
  value,
  valuePending,
  onChange,
  onContextMenu,
  onUseRecentNumberValue,
  showToast,
  animationDelay,
  dateTransitionDir,
  favorite,
  onToggleFavorite,
  closable,
  onClose
}) {
  return (
    <div
      className={`section-card number-card date-card-${dateTransitionDir}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onContextMenu={onContextMenu}
    >
      <div className="number-card-content">
        <div className="number-card-left">
          <span className="section-card-title">{section.name}</span>
          <SectionTypeBadge section={section} closable={closable} onClose={onClose} />
          <FavoriteButton favorite={favorite} onToggle={onToggleFavorite} name={section.name} />
        </div>
        <div className="number-card-right">
          <NumberInput
            sectionId={section.id}
            value={value}
            pending={valuePending}
            unit={section.unit}
            onChange={onChange}
            onUseRecentValue={onUseRecentNumberValue}
            showToast={showToast}
          />
        </div>
      </div>
    </div>
  )
}
