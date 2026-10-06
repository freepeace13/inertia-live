import { CursorStore } from '../src/core/cursors'

describe('CursorStore', () => {
  it('starts at 0', () => {
    expect(new CursorStore().get('documents.a')).toBe(0)
  })

  it('accepts newer signals and advances', () => {
    const cursors = new CursorStore()
    cursors.raise('documents.a', 5)

    expect(cursors.accept('documents.a', 6)).toBe(true)
    expect(cursors.get('documents.a')).toBe(6)
  })

  it('drops equal and older signals', () => {
    const cursors = new CursorStore()
    cursors.raise('documents.a', 5)

    expect(cursors.accept('documents.a', 5)).toBe(false)
    expect(cursors.accept('documents.a', 4)).toBe(false)
    expect(cursors.get('documents.a')).toBe(5)
  })

  it('keeps the max under out-of-order delivery', () => {
    const cursors = new CursorStore()

    cursors.accept('documents.a', 9)
    cursors.accept('documents.a', 7)
    cursors.raise('documents.a', 3)

    expect(cursors.get('documents.a')).toBe(9)
  })

  it('tracks topics independently and can forget', () => {
    const cursors = new CursorStore()
    cursors.raise('documents.a', 5)

    expect(cursors.get('documents.b')).toBe(0)

    cursors.forget('documents.a')
    expect(cursors.get('documents.a')).toBe(0)
  })
})
