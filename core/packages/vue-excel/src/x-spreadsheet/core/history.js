// import helper from '../helper';

export default class History {
  constructor(maxLength = 100) {
    this.undoItems = [];
    this.redoItems = [];
    this.maxLength = maxLength;
  }

  add(data) {
    this.undoItems.push(JSON.stringify(data));
    if (this.undoItems.length > this.maxLength) {
      this.undoItems.shift();
    }
    this.redoItems = [];
  }

  canUndo() {
    return this.undoItems.length > 0;
  }

  canRedo() {
    return this.redoItems.length > 0;
  }

  undo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canUndo()) {
      const currentSnapshot = JSON.stringify(currentd);
      const raw = undoItems[undoItems.length - 1];
      const prev = JSON.parse(raw);
      undoItems.pop();
      redoItems.push(currentSnapshot);
      try {
        cb(prev);
      } catch (e) {
        redoItems.pop();
        undoItems.push(raw);
        throw e;
      }
    }
  }

  redo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      const currentSnapshot = JSON.stringify(currentd);
      const raw = redoItems[redoItems.length - 1];
      const next = JSON.parse(raw);
      redoItems.pop();
      undoItems.push(currentSnapshot);
      const shifted = undoItems.length > this.maxLength ? undoItems.shift() : undefined;
      try {
        cb(next);
      } catch (e) {
        if (shifted !== undefined) undoItems.unshift(shifted);
        undoItems.pop();
        redoItems.push(raw);
        throw e;
      }
    }
  }
}
