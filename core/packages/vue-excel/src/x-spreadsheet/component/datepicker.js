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
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
        const parsed = new Date(date.replace(/-/g, '/'));
        if (!Number.isNaN(parsed.getTime())) {
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
