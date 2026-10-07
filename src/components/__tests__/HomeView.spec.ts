import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '@/views/HomeView.vue'

describe('room loading', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads a bundled room and supplies it to the visualizer', async () => {
    const data = { corners: [], walls: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))))
    const wrapper = mount(HomeView, { global: { stubs: { RoomVisualizer: true } } })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'RoomVisualizer' }).props('roomData')).toEqual(data)
    expect(wrapper.text()).not.toContain('Loading room data')
  })

  it('handles unavailable room files without rendering malformed room data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })))
    const wrapper = mount(HomeView, { global: { stubs: { RoomVisualizer: true } } })
    await flushPromises()
    expect(wrapper.find('.error').text()).toContain('Failed to load')
    expect(wrapper.findComponent({ name: 'RoomVisualizer' }).exists()).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })
})
