import DateRangeMenu from '../../components/DateRangeMenu'
import SelectMenu from '../../components/SelectMenu'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import '../../components/FilterChip.css'

// Search, list / preview switch and management on top; the filters underneath.
export default function TimelineToolbar({
  sections,
  favoritesCount,
  filters,
  isPreview,
  onViewChange,
  isManageMode,
  onToggleManage,
  onSearchChange,
  onSearchKeyDown
}) {
  const viewSwitchThumbRef = useSlidingThumb()
  const { filterSections } = filters
  const sectionFilterLabel = filterSections.length === 0
    ? '所有版块'
    : filterSections.length === 1
      ? (sections.find(item => item.id === filterSections[0])?.name || '1 个版块')
      : `${filterSections.length} 个版块`

  return (
    <div className="timeline-toolbar">
      <div className="timeline-toolbar-main">
        <div className="search-wrap flex-1">
          <span className="search-icon">⌕</span>
          <input
            className="input search-input"
            placeholder="搜索记录内容..."
            value={filters.query}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        <div className="segmented-control timeline-view-switch" role="radiogroup" aria-label="查看方式" ref={viewSwitchThumbRef}>
          <button
            type="button"
            role="radio"
            aria-checked={!isPreview}
            className={`segmented-btn ${!isPreview ? 'active' : ''}`}
            onClick={() => onViewChange('list')}
            title="按日期查看摘要"
          >
            ☰ 列表
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isPreview}
            className={`segmented-btn ${isPreview ? 'active' : ''}`}
            onClick={() => onViewChange('preview')}
            title="按当前筛选条件连续阅读完整内容"
          >
            📖 预览
          </button>
        </div>
        <button
          type="button"
          className={`btn btn-sm ${isManageMode ? 'btn-secondary' : 'btn-ghost'}`}
          disabled={isPreview || filters.onlyFavorites}
          onClick={onToggleManage}
          title={isPreview ? '预览模式下不可管理' : filters.onlyFavorites ? '收藏视图下不可批量删除' : isManageMode ? '退出管理' : '管理时间线'}
        >
          {isManageMode ? '退出管理' : '⚙ 管理'}
        </button>
      </div>

      <div className="timeline-toolbar-filters">
        <SelectMenu
          multiple
          ariaLabel="筛选版块"
          options={sections.map(s => ({ value: s.id, label: s.name, color: s.color }))}
          value={filterSections}
          onChange={filters.setFilterSections}
          trigger={({ ref, props, open }) => (
            <button
              ref={ref}
              {...props}
              className={`filter-chip ${filterSections.length ? 'is-active' : ''} ${open ? 'is-open' : ''}`}
            >
              <span className="filter-chip-icon" aria-hidden="true">▤</span>
              <span className="filter-chip-text">{sectionFilterLabel}</span>
              <span className="filter-chip-chevron" aria-hidden="true">▾</span>
            </button>
          )}
        />
        <DateRangeMenu from={filters.dateFrom} to={filters.dateTo} onChange={filters.setDateRange} />
        <button
          type="button"
          className={`filter-chip ${filters.onlyFavorites ? 'is-active' : ''}`}
          aria-pressed={filters.onlyFavorites}
          onClick={filters.toggleOnlyFavorites}
          title="只看已收藏的内容"
        >
          <span className="filter-chip-icon" aria-hidden="true">{filters.onlyFavorites ? '★' : '☆'}</span>
          <span className="filter-chip-text">收藏{favoritesCount ? ` ${favoritesCount}` : ''}</span>
        </button>
        <span className="timeline-toolbar-spacer" />
        <button type="button" className="filter-chip" onClick={filters.toggleSort} title="切换日期排序">
          <span className="filter-chip-text">{filters.sortDesc ? '↓ 新到旧' : '↑ 旧到新'}</span>
        </button>
        {filters.hasActiveFilter && (
          <button type="button" className="filter-chip is-clear" onClick={filters.clearFilters}>
            <span className="filter-chip-text">✕ 清除筛选</span>
          </button>
        )}
      </div>
    </div>
  )
}
