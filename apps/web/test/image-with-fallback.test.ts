import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ImageWithFallback } from '@ake/ui'

describe('ImageWithFallback', () => {
  it('uses the fallback once, exposes terminal failure accessibly, and recovers when src changes', async () => {
    const wrapper = mount(ImageWithFallback, {
      props: {
        src: '/primary.png',
        fallbackSrc: '/fallback.png',
        alt: 'Character portrait',
        width: 144,
        height: 96,
        aspectRatio: '3 / 2',
        objectFit: 'cover'
      },
      slots: { fallback: '<strong data-test="fallback-content">Missing image</strong>' }
    })

    const primary = wrapper.get('img')
    expect(primary.attributes()).toMatchObject({
      src: '/primary.png',
      alt: 'Character portrait',
      width: '144',
      height: '96',
      loading: 'lazy',
      decoding: 'async'
    })
    expect(wrapper.get('.ake-image').attributes('style')).toContain('aspect-ratio: 3 / 2')
    expect(wrapper.get('.ake-image').attributes('style')).toContain('--ake-image-fit: cover')

    await primary.trigger('load')
    expect(wrapper.emitted('load')).toHaveLength(1)

    await primary.trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe('/fallback.png')
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('fallback')).toHaveLength(1)

    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Character portrait')
    expect(wrapper.get('[data-test="fallback-content"]').text()).toBe('Missing image')
    expect(wrapper.classes()).toContain('ake-image--failed')
    expect(wrapper.emitted('error')).toHaveLength(2)
    expect(wrapper.emitted('fallback')).toHaveLength(1)

    await wrapper.setProps({ src: '/replacement.png' })
    expect(wrapper.get('img').attributes('src')).toBe('/replacement.png')
    expect(wrapper.classes()).not.toContain('ake-image--failed')
  })

  it('starts at the default fallback when src is empty and does not retry it', async () => {
    const wrapper = mount(ImageWithFallback, { props: { alt: 'Missing item' } })

    expect(wrapper.get('img').attributes('src')).toBe('/icon_default_missing.png')
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Missing item')
    expect(wrapper.emitted('fallback')).toBeUndefined()
  })
})
