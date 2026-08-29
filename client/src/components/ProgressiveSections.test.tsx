import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProgressiveSections, type ResultSection } from './ProgressiveSections'
import { makeActionCards } from '../test/fixtures'
import {
  installIntersectionObserverMock,
  observerAt,
  observerCount,
  triggerLatestIntersection,
} from '../test/intersectionObserver'

function mountedRows(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('.results-list__item'))
}

describe('ProgressiveSections', () => {
  beforeEach(() => {
    installIntersectionObserverMock()
  })

  it('applies the initial row budget globally across sections', () => {
    const cards = makeActionCards(12)
    const sections: ResultSection[] = [
      { key: 'first', title: 'First', groups: [{ cards: cards.slice(0, 6) }] },
      { key: 'second', title: 'Second', groups: [{ cards: cards.slice(6) }] },
    ]

    const { container } = render(<ProgressiveSections sections={sections} />)

    expect(mountedRows(container)).toHaveLength(8)
    expect(screen.getByText('Card 06')).toBeInTheDocument()
    expect(screen.getByText('Card 08')).toBeInTheDocument()
    expect(screen.queryByText('Card 09')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument()
    expect(container.querySelector('.results-sentinel')).toBeInTheDocument()
  })

  it('reveals successive batches until every row is mounted', () => {
    const sections: ResultSection[] = [
      { key: 'cards', groups: [{ cards: makeActionCards(20) }] },
    ]
    const { container } = render(<ProgressiveSections sections={sections} />)

    expect(mountedRows(container)).toHaveLength(8)

    act(() => triggerLatestIntersection())
    expect(mountedRows(container)).toHaveLength(16)

    act(() => triggerLatestIntersection())
    expect(mountedRows(container)).toHaveLength(20)
    expect(screen.getByText('Card 20')).toBeInTheDocument()
    expect(container.querySelector('.results-sentinel')).not.toBeInTheDocument()
  })

  it('re-observes a visible sentinel without stalling', () => {
    const sections: ResultSection[] = [
      { key: 'cards', groups: [{ cards: makeActionCards(33) }] },
    ]
    const { container } = render(<ProgressiveSections sections={sections} />)

    for (const expectedCount of [16, 24, 32, 33]) {
      const previousObserverIndex = observerCount() - 1
      act(() => triggerLatestIntersection())
      expect(mountedRows(container)).toHaveLength(expectedCount)
      expect(observerAt(previousObserverIndex).disconnect).toHaveBeenCalledOnce()
    }

    expect(screen.getByText('Card 33')).toBeInTheDocument()
  })

  it('skips empty content and counts a lead node against the budget', () => {
    const sections: ResultSection[] = [
      { key: 'empty', title: 'Empty section', groups: [{ cards: [] }] },
      {
        key: 'populated',
        title: 'Populated section',
        leadNode: <div>Faction setup</div>,
        groups: [
          { subtitle: 'Empty group', cards: [] },
          { subtitle: 'Cards', cards: makeActionCards(10) },
        ],
      },
    ]

    const { container } = render(<ProgressiveSections sections={sections} />)

    expect(screen.queryByRole('heading', { name: 'Empty section' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Empty group' })).not.toBeInTheDocument()
    expect(screen.getByText('Faction setup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument()
    expect(mountedRows(container)).toHaveLength(7)

    act(() => triggerLatestIntersection())
    expect(mountedRows(container)).toHaveLength(10)
    expect(screen.getByText('Card 08')).toBeInTheDocument()
  })

  it('resets to the initial budget when its key changes', () => {
    const firstSections: ResultSection[] = [
      { key: 'first', groups: [{ cards: makeActionCards(20, 'first') }] },
    ]
    const secondSections: ResultSection[] = [
      {
        key: 'second',
        groups: [{
          cards: makeActionCards(12, 'second').map((card) => ({
            ...card,
            name: `New ${card.name}`,
          })),
        }],
      },
    ]
    const { container, rerender } = render(
      <ProgressiveSections key="first-query" sections={firstSections} />
    )

    act(() => triggerLatestIntersection())
    expect(mountedRows(container)).toHaveLength(16)

    rerender(<ProgressiveSections key="second-query" sections={secondSections} />)

    expect(mountedRows(container)).toHaveLength(8)
    expect(screen.getByText('New Card 01')).toBeInTheDocument()
    expect(screen.queryByText('Card 01', { exact: true })).not.toBeInTheDocument()
  })

  it('honors custom initial and batch sizes', () => {
    const sections: ResultSection[] = [
      { key: 'cards', groups: [{ cards: makeActionCards(10) }] },
    ]
    const { container } = render(
      <ProgressiveSections sections={sections} initialCount={3} batchSize={2} />
    )

    expect(mountedRows(container)).toHaveLength(3)
    act(() => triggerLatestIntersection())
    expect(mountedRows(container)).toHaveLength(5)
  })
})
