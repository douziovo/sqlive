import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import HoverPreview from '../../components/HoverPreview.vue';
import type { PreviewItem } from '../../components/HoverPreview.vue';

const sampleItems: PreviewItem[] = [
  { id: 'idx-1', icon: '\u{1F4CB}', label: 'idx_employees_dept', meta: ['列: dept_id  ·  普通'] },
  { id: 'idx-2', icon: '\u{1F48E}', label: 'idx_employees_email', meta: ['列: email  ·  UNIQUE'], accent: 'blue' },
];

function mountPreview(overrides: Record<string, any> = {}) {
  const triggerEl = document.createElement('div');
  document.body.appendChild(triggerEl);

  return {
    wrapper: mount(HoverPreview, {
      props: {
        show: false,
        triggerEl,
        icon: '\u{1F4C7}',
        title: '索引 · employees 表',
        subtitle: '共 6 个索引',
        categoryName: '索引',
        items: sampleItems,
        ...overrides,
      },
      global: { stubs: { teleport: true } },
    }),
    triggerEl,
  };
}

async function showPreview(wrapper: ReturnType<typeof mount>, overrides: Record<string, any> = {}) {
  await wrapper.setProps({ show: true, ...overrides });
  await vi.advanceTimersByTimeAsync(350);
}

describe('HoverPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows title when show becomes true', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);
    expect(wrapper.text()).toContain('索引 · employees 表');
  });

  it('shows subtitle', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);
    expect(wrapper.text()).toContain('共 6 个索引');
  });

  it('renders all items', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);
    expect(wrapper.text()).toContain('idx_employees_dept');
    expect(wrapper.text()).toContain('idx_employees_email');
  });

  it('filters items by text', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);

    const input = wrapper.find('input');
    await input.setValue('email');
    await nextTick();

    expect(wrapper.text()).toContain('idx_employees_email');
    expect(wrapper.text()).not.toContain('idx_employees_dept');
  });

  it('shows "无匹配项" when filter has no matches', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);

    const input = wrapper.find('input');
    await input.setValue('zzz_nonexistent');
    await nextTick();

    expect(wrapper.text()).toContain('无匹配项');
  });

  it('shows filtered count', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);

    const input = wrapper.find('input');
    await input.setValue('email');
    await nextTick();

    expect(wrapper.text()).toContain('1/2');
  });

  it('emits select when item is clicked', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);

    const firstItem = wrapper.find('[class*="cursor-pointer"]');
    await firstItem.trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
  });

  it('handles empty items array gracefully', async () => {
    const { wrapper } = mountPreview({ items: [] });
    await showPreview(wrapper, { items: [] });
    // Should render without crashing — the popup content renders
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('updates cache when props change while visible', async () => {
    const { wrapper } = mountPreview();
    await showPreview(wrapper);
    expect(wrapper.text()).toContain('索引 · employees 表');

    await wrapper.setProps({
      title: '触发器 · employees 表',
      subtitle: '共 4 个触发器',
      icon: '\u{26A1}',
      categoryName: '触发器',
      items: [
        { id: 'trg-1', icon: '\u{26A1}', label: 'trg_employees_insert', meta: ['AFTER INSERT'] },
      ],
    });
    await nextTick();

    expect(wrapper.text()).toContain('触发器 · employees 表');
    expect(wrapper.text()).toContain('共 4 个触发器');
    expect(wrapper.text()).toContain('trg_employees_insert');
  });
});
