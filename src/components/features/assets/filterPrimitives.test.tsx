/**
 * Render tests for the three filter-bar primitives:
 *   SelectMini, ViewPopover, GroupTabs
 *
 * These components render to document.body via createPortal.
 * @testing-library/react queries on `screen` see portaled content automatically.
 * No i18n provider needed — all display text is passed in as props.
 * No router needed.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectMini } from '../../ui/SelectMini'
import { ViewPopover } from './ViewPopover'
import { GroupTabs } from './GroupTabs'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const selectOptions = [
  { value: 'all',     label: 'All statuses' },
  { value: 'active',  label: 'Active' },
  { value: 'repair',  label: 'In repair' },
]

const viewOptions = [
  { value: 'updated_desc', label: 'Last updated',   shortLabel: 'Updated', hint: 'Most recently changed first', icon: 'clock', iconColor: '#94A3B8' },
  { value: 'name_asc',     label: 'Name A → Z',     shortLabel: 'A–Z',     hint: 'Alphabetical by name',        icon: 'arrow-down-a-z', iconColor: '#94A3B8' },
  { value: 'created_desc', label: 'Date created',   shortLabel: 'Created', hint: 'Newest first',                icon: 'arrow-down-narrow-wide', iconColor: '#94A3B8' },
]

const groupTabs = [
  { id: 'all',       label: 'All',       icon: 'package' },
  { id: 'computers', label: 'Computers', icon: 'laptop'  },
  { id: 'phones',    label: 'Phones',    icon: 'smartphone' },
]

const groupCounts: Record<string, number> = { all: 42, computers: 18, phones: 7 }

// ---------------------------------------------------------------------------
// SelectMini
// ---------------------------------------------------------------------------

describe('SelectMini', () => {
  // (a) trigger shows the active option's label
  test('(a) renders trigger with the active option label visible', () => {
    // Arrange
    render(
      <SelectMini
        label="Status"
        value="active"
        onChange={() => {}}
        options={selectOptions}
      />
    )

    // Assert — the trigger button contains the active option's label text
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  // (b) clicking trigger opens listbox with one role="option" per option
  test('(b) clicking trigger opens listbox with one option per entry', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <SelectMini
        label="Status"
        value="active"
        onChange={() => {}}
        options={selectOptions}
      />
    )

    // Act
    const trigger = screen.getByRole('button', { name: 'Status' })
    await user.click(trigger)

    // Assert
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()

    const optionEls = within(listbox).getAllByRole('option')
    expect(optionEls).toHaveLength(selectOptions.length)
  })

  // (c) clicking a non-active option calls onChange with that value
  test('(c) clicking a non-active option calls onChange with its value', async () => {
    // Arrange
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <SelectMini
        label="Status"
        value="active"
        onChange={handleChange}
        options={selectOptions}
      />
    )

    // Act — open then click "In repair"
    await user.click(screen.getByRole('button', { name: 'Status' }))
    const listbox = screen.getByRole('listbox')
    const repairOption = within(listbox).getByRole('option', { name: /In repair/i })
    await user.click(repairOption)

    // Assert
    expect(handleChange).toHaveBeenCalledOnce()
    expect(handleChange).toHaveBeenCalledWith('repair')
  })

  // (d) the active option has aria-selected="true"
  test('(d) the active option has aria-selected=true; others false', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <SelectMini
        label="Status"
        value="active"
        onChange={() => {}}
        options={selectOptions}
      />
    )

    // Act — open the listbox
    await user.click(screen.getByRole('button', { name: 'Status' }))

    // Assert
    const listbox = screen.getByRole('listbox')
    const activeOption = within(listbox).getByRole('option', { name: /Active/i })
    expect(activeOption).toHaveAttribute('aria-selected', 'true')

    const allStatusOption = within(listbox).getByRole('option', { name: /All statuses/i })
    expect(allStatusOption).toHaveAttribute('aria-selected', 'false')
  })

  // Escape closes the listbox
  test('pressing Escape closes the listbox', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <SelectMini
        label="Status"
        value="all"
        onChange={() => {}}
        options={selectOptions}
      />
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    // Assert
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ViewPopover
// ---------------------------------------------------------------------------

describe('ViewPopover', () => {
  // (e) trigger shows the active option's shortLabel
  test('(e) trigger shows the active option shortLabel', () => {
    // Arrange — active sort is 'name_asc' whose shortLabel is 'A–Z'
    render(
      <ViewPopover
        sort="name_asc"
        onChangeSort={() => {}}
        options={viewOptions}
        defaultSort="updated_desc"
        viewLabel="View"
        title="Sort order"
        subtitle="Choose how assets are ordered"
      />
    )

    // Assert — shortLabel visible in trigger area before opening
    expect(screen.getByText('A–Z')).toBeInTheDocument()
  })

  // (f) opening shows title + subtitle; one button per option; clicking calls onChangeSort
  test('(f) opening shows title, subtitle and option buttons; clicking one calls onChangeSort', async () => {
    // Arrange
    const user = userEvent.setup()
    const handleChangeSort = vi.fn()
    render(
      <ViewPopover
        sort="updated_desc"
        onChangeSort={handleChangeSort}
        options={viewOptions}
        defaultSort="updated_desc"
        viewLabel="View"
        title="Sort order"
        subtitle="Choose how assets are ordered"
      />
    )

    // Act — open the popover
    const trigger = screen.getByRole('button', { name: 'View' })
    await user.click(trigger)

    // Assert — header text visible
    const portal = document.querySelector('[data-vp-portal="true"]') as HTMLElement
    expect(portal).not.toBeNull()
    expect(within(portal).getByText('Sort order')).toBeInTheDocument()
    expect(within(portal).getByText('Choose how assets are ordered')).toBeInTheDocument()

    // Assert — one button per option (label text)
    for (const opt of viewOptions) {
      expect(within(portal).getByText(opt.label)).toBeInTheDocument()
    }

    // Act — click "Name A → Z"
    const nameAZBtn = within(portal).getByText('Name A → Z')
    await user.click(nameAZBtn)

    // Assert
    expect(handleChangeSort).toHaveBeenCalledOnce()
    expect(handleChangeSort).toHaveBeenCalledWith('name_asc')
  })
})

// ---------------------------------------------------------------------------
// GroupTabs
// ---------------------------------------------------------------------------

describe('GroupTabs', () => {
  // (g) renders a button per tab with label and count
  test('(g) renders a button per tab showing its label and count', () => {
    // Arrange
    render(
      <GroupTabs
        tabs={groupTabs}
        selected="all"
        onSelect={() => {}}
        counts={groupCounts}
      />
    )

    // Assert — each tab's label text and count are in the document
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Computers')).toBeInTheDocument()
    expect(screen.getByText('Phones')).toBeInTheDocument()

    // Counts rendered as numeric text
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // (h) selected tab has aria-pressed=true; others false
  test('(h) selected tab has aria-pressed=true; non-selected tabs have aria-pressed=false', () => {
    // Arrange
    render(
      <GroupTabs
        tabs={groupTabs}
        selected="computers"
        onSelect={() => {}}
        counts={groupCounts}
      />
    )

    // Find each button by accessible name (label text is inside the button)
    const buttons = screen.getAllByRole('button')
    // buttons are in DOM order: All, Computers, Phones
    const [allBtn, computersBtn, phonesBtn] = buttons

    // Assert
    expect(allBtn).toHaveAttribute('aria-pressed', 'false')
    expect(computersBtn).toHaveAttribute('aria-pressed', 'true')
    expect(phonesBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // (i) clicking a tab calls onSelect with its id
  test('(i) clicking a tab calls onSelect with the tab id', async () => {
    // Arrange
    const user = userEvent.setup()
    const handleSelect = vi.fn()
    render(
      <GroupTabs
        tabs={groupTabs}
        selected="all"
        onSelect={handleSelect}
        counts={groupCounts}
      />
    )

    // Act — click "Phones" tab
    const phonesBtn = screen.getAllByRole('button')[2]!
    await user.click(phonesBtn)

    // Assert
    expect(handleSelect).toHaveBeenCalledOnce()
    expect(handleSelect).toHaveBeenCalledWith('phones')
  })
})
