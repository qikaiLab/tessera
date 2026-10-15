import NumberCard from './NumberCard'
import TextCard from './TextCard'
import './SectionCard.css'

// One record card: a slim stepper bar for number sections, an editor card for text sections.
export default function SectionCard(props) {
  return props.section.type === 'number' ? <NumberCard {...props} /> : <TextCard {...props} />
}
