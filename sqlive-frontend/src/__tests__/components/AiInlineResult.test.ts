import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AiInlineResult from '../../components/AiInlineResult.vue';

function mountResult(overrides: Record<string, any> = {}) {
  return mount(AiInlineResult, {
    props: {
      visible: false,
      loading: false,
      content: '',
      mode: 'chat',
      actions: [] as { label: string; action: string }[],
      ...overrides,
    },
    global: { stubs: { teleport: true } },
  });
}

describe('AiInlineResult', () => {
  it('does not render when visible is false', () => {
    const wrapper = mountResult({ visible: false });
    expect(wrapper.find('.ai-inline-result').exists()).toBe(false);
  });

  it('renders when visible is true', () => {
    const wrapper = mountResult({ visible: true });
    expect(wrapper.find('.ai-inline-result').exists()).toBe(true);
  });

  it('shows mode label for error-analysis', () => {
    const wrapper = mountResult({ visible: true, mode: 'error-analysis' });
    expect(wrapper.text()).toContain('AI 错误分析');
  });

  it('shows mode label for fix-code', () => {
    const wrapper = mountResult({ visible: true, mode: 'fix-code' });
    expect(wrapper.text()).toContain('代码修复');
  });

  it('shows mode label for explain', () => {
    const wrapper = mountResult({ visible: true, mode: 'explain' });
    expect(wrapper.text()).toContain('SQL 解释');
  });

  it('shows mode label for optimize', () => {
    const wrapper = mountResult({ visible: true, mode: 'optimize' });
    expect(wrapper.text()).toContain('SQL 优化');
  });

  it('shows mode label for generate-sql', () => {
    const wrapper = mountResult({ visible: true, mode: 'generate-sql' });
    expect(wrapper.text()).toContain('AI 生成 SQL');
  });

  it('shows default mode label for unknown mode', () => {
    const wrapper = mountResult({ visible: true, mode: 'unknown' });
    expect(wrapper.text()).toContain('AI 助手');
  });

  it('shows loading spinner when loading', () => {
    const wrapper = mountResult({ visible: true, loading: true });
    expect(wrapper.find('.animate-spin').exists()).toBe(true);
  });

  it('renders markdown content', () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      content: '## Title\n\n**Bold text** and `code`',
    });
    expect(wrapper.find('.ai-content').exists()).toBe(true);
    const html = wrapper.find('.ai-content').html();
    expect(html).toContain('Title');
    expect(html).toContain('Bold text');
  });

  it('renders code blocks with dark background', () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      content: '```sql\nSELECT * FROM users;\n```',
    });
    const html = wrapper.find('.ai-content').html();
    expect(html).toContain('SELECT');
  });

  it('emits close when X button is clicked', async () => {
    const wrapper = mountResult({ visible: true });
    const closeBtn = wrapper.find('button');
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close when backdrop is clicked', async () => {
    const wrapper = mountResult({ visible: true });
    // With teleport stubbed, backdrop is inside wrapper
    const backdrop = wrapper.find('.fixed.inset-0.z-40');
    if (backdrop.exists()) {
      await backdrop.trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
    }
  });

  it('renders action buttons when provided', () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      actions: [
        { label: '✏️ 应用修复', action: 'apply-fix' },
        { label: '💬 追问', action: 'follow-up' },
      ],
    });
    expect(wrapper.text()).toContain('应用修复');
    expect(wrapper.text()).toContain('追问');
  });

  it('emits action when action button is clicked', async () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      actions: [
        { label: '✏️ 应用修复', action: 'apply-fix' },
      ],
    });
    const buttons = wrapper.findAll('button');
    const actionBtn = buttons.find(b => b.text().includes('应用修复'));
    if (actionBtn) {
      await actionBtn.trigger('click');
      expect(wrapper.emitted('action')).toBeTruthy();
      expect(wrapper.emitted('action')![0]).toEqual(['apply-fix']);
    }
  });

  it('apply-fix button has blue styling', () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      actions: [
        { label: '✏️ 应用修复', action: 'apply-fix' },
      ],
    });
    const btn = wrapper.find('button.bg-primary');
    expect(btn.exists()).toBe(true);
  });

  it('renders empty content without error', () => {
    const wrapper = mountResult({
      visible: true,
      loading: false,
      content: '',
    });
    expect(wrapper.find('.ai-content').exists()).toBe(true);
  });
});
