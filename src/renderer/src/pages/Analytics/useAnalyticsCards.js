import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { DATE_AXIS_RECORDED, LINE_STYLE_SMOOTH } from '../../utils/analyticsCard'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function defaultCard(index) {
  return {
    id: generateId(),
    title: `图表 ${index + 1}`,
    type: 'bar',
    bindings: [],
    dateRange: '30',
    dateAxisMode: DATE_AXIS_RECORDED,
    lineStyle: LINE_STYLE_SMOOTH,
    dateFrom: '',
    dateTo: ''
  }
}

// Brings a card into view once it has been added (after the grid has rendered it).
function scrollCardIntoView(cardId) {
  setTimeout(() => {
    document.getElementById(`analytics-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}

/**
 * The chart cards of the analytics page: adding, editing, duplicating, reordering and deleting
 * (with a confirmation: `pendingDelete` is the card waiting for it). `setCards` takes a list or
 * an updater, like a state setter.
 */
export function useAnalyticsCards({ cards, setCards }) {
  const [editingCard, setEditingCard] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const addCard = () => {
    const card = defaultCard(cards.length)
    setCards(prev => [...prev, card])
    setEditingCard(card.id)
    scrollCardIntoView(card.id)
  }

  const updateCard = (id, updates) => {
    setCards(prev => prev.map(card => (card.id === id ? { ...card, ...updates } : card)))
  }

  const toggleEditing = (id) => setEditingCard(current => (current === id ? null : id))

  const duplicateCard = (id) => {
    const source = cards.find(card => card.id === id)
    if (!source) return
    const copy = { ...source, id: generateId(), title: `${source.title} 副本` }
    setCards(prev => [...prev, copy])
    scrollCardIntoView(copy.id)
  }

  const confirmDelete = () => {
    if (pendingDelete) {
      setCards(prev => prev.filter(card => card.id !== pendingDelete))
      if (editingCard === pendingDelete) setEditingCard(null)
    }
    setPendingDelete(null)
  }

  const handleDragEnd = ({ active, over }) => {
    // Dropping outside every card leaves `over` empty: nothing to reorder.
    if (!over || active.id === over.id) return
    setCards(prev => arrayMove(
      prev,
      prev.findIndex(card => card.id === active.id),
      prev.findIndex(card => card.id === over.id)
    ))
  }

  return {
    editingCard,
    toggleEditing,
    pendingDelete,
    requestDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
    addCard,
    updateCard,
    duplicateCard,
    handleDragEnd
  }
}
