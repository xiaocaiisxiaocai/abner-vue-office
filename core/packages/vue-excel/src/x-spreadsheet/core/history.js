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
      redoItems.push(JSON.stringify(currentd));
      cb(JSON.parse(undoItems.pop()));
    }
  }

  redo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      undoItems.push(JSON.stringify(currentd));
      cb(JSON.parse(redoItems.pop()));
    }
  }
}
