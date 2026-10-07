import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CoverWorkshop from '../components/CoverWorkshop.vue';
import { coverPresetFor } from '../../core/cover-presets';

describe('CoverWorkshop', () => {
  it('按共享排版结果分行展示气泡文字', () => {
    const wrapper = mount(CoverWorkshop, { props: { config: { ...coverPresetFor('元气满满'), bubbleText: '第一行\n第二行' }, title: '测试' } });
    expect(wrapper.findAll('.cover-bubble span').map((s) => s.text())).toEqual(['第一行', '第二行']);
    expect(wrapper.find('[data-testid="save-work"]').attributes('disabled')).toBeUndefined();
  });
  it('文字超出安全区时提示并禁用保存，原文一字不删', () => {
    const config = { ...coverPresetFor('元气满满'), bubbleText: '好'.repeat(2000) };
    const wrapper = mount(CoverWorkshop, { props: { config, title: '测试' } });
    expect(wrapper.text()).toContain('放不下');
    expect(wrapper.find('[data-testid="save-work"]').attributes('disabled')).toBeDefined();
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toHaveLength(2000);
  });
  it('正常文字可以触发保存', async () => {
    const wrapper = mount(CoverWorkshop, { props: { config: coverPresetFor('元气满满'), title: '测试' } });
    await wrapper.get('[data-testid="save-work"]').trigger('click');
    expect(wrapper.emitted('save')).toHaveLength(1);
  });
});
