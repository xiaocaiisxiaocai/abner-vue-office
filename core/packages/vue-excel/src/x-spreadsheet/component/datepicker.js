import Calendar from './calendar';
import { h } from './element';
import { cssPrefix } from '../config';

export default class Datepicker {
  constructor() {
    this.calendar = new Calendar(new Date());
    this.el = h('div', `${cssPrefix}-datepicker`).child(
      this.calendar.el,
    ).hide();
  }

  setValue(date) {
    const { calendar } = this;
    if (typeof date === 'string') {
      const m = date.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const parsed = new Date(y, mo - 1, d);
        if (parsed.getFullYear() === y && parsed.getMonth() === mo - 1 && parsed.getDate() === d) {
          calendar.setValue(parsed);
          return this;
        }
      }
      calendar.setValue(new Date());
    } else if (date instanceof Date && !Number.isNaN(date.getTime())) {
      calendar.setValue(date);
    } else {
      calendar.setValue(new Date());
    }
    return this;
  }

  change(cb) {
    this.calendar.selectChange = (d) => {
      cb(d);
      this.hide();
    };
  }

  show() {
    this.el.show();
  }

  hide() {
    this.el.hide();
  }
}
