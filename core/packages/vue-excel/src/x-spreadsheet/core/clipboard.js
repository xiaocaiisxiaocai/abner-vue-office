export default class Clipboard {
  constructor() {
    this.range = null; // CellRange
    this.state = 'clear';
  }

  copy(cellRange) {
    if (!cellRange) {
      this.clear();
      return this;
    }
    this.range = typeof cellRange.clone === 'function' ? cellRange.clone() : cellRange;
    this.state = 'copy';
    return this;
  }

  cut(cellRange) {
    if (!cellRange) {
      this.clear();
      return this;
    }
    this.range = typeof cellRange.clone === 'function' ? cellRange.clone() : cellRange;
    this.state = 'cut';
    return this;
  }

  isCopy() {
    return this.state === 'copy';
  }

  isCut() {
    return this.state === 'cut';
  }

  isClear() {
    return this.state === 'clear';
  }

  clear() {
    this.range = null;
    this.state = 'clear';
  }
}
