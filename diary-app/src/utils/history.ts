/**
 * 写作页的撤销 / 重做历史（纯逻辑，便于测试）。
 * 连续打字会在一个时间窗口内合并成一步，避免「撤销一次只退一个字」；
 * 格式化、听写、套用模板这类整段修改则各自独立成一步。
 */
export class TextHistory {
  private stack: string[];
  private index = 0;
  private lastPushAt = 0;

  constructor(initial = '', private readonly windowMs = 900, private readonly limit = 80) {
    this.stack = [initial];
  }

  /** 记录一次变化。force = true 时不与上一步合并。 */
  push(value: string, now = Date.now(), force = false) {
    if (value === this.stack[this.index]) return;
    const redoPending = this.index < this.stack.length - 1;
    // 只有「紧接着上一步、且不在撤销中途」的输入才合并
    const merge = !force && !redoPending && this.index > 0 && now - this.lastPushAt < this.windowMs;
    if (redoPending) this.stack = this.stack.slice(0, this.index + 1);
    if (merge) {
      this.stack[this.index] = value;
    } else {
      this.stack.push(value);
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
    }
    this.lastPushAt = now;
  }

  /** 下一次 push 不与当前这一步合并（用于格式化等整段操作之后） */
  seal() {
    this.lastPushAt = 0;
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.stack.length - 1;
  }

  undo(): string | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    this.lastPushAt = 0;
    return this.stack[this.index];
  }

  redo(): string | null {
    if (!this.canRedo) return null;
    this.index += 1;
    this.lastPushAt = 0;
    return this.stack[this.index];
  }

  /** 换了一篇日记时重置 */
  reset(initial = '') {
    this.stack = [initial];
    this.index = 0;
    this.lastPushAt = 0;
  }
}
