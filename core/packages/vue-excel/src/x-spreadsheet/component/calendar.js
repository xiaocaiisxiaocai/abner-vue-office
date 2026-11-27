import { h } from './element';
import Icon from './icon';
import { t } from '../locale/locale';

function toValidDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  return new Date();
}

function addMonth(date, step) {
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + step);
  const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, maxDay));
}

function weekday(date, index) {
  const d = new Date(date);
  d.setDate(index - date.getDay() + 1);
  return d;
}

function monthDays(year, month, cdate) {
  // the first day of month
  const startDate = new Date(year, month, 1, 23, 59, 59);
  const datess = [[], [], [], [], [], []];
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 7; j += 1) {
      const index = i * 7 + j;
      const d = weekday(startDate, index);
      const disabled = d.getMonth() !== month;
      const active = d.getFullYear() === cdate.getFullYear()
        && d.getMonth() === cdate.getMonth()
        && d.getDate() === cdate.getDate();
      datess[i][j] = { d, disabled, active };
    }
  }
  return datess;
}

const fallbackWeeks = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fallbackMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default class Calendar {
  constructor(value) {
    this.value = toValidDate(value);
    this.cvalue = new Date(this.value.getTime());

    this.headerLeftEl = h('div', 'calendar-header-left');
    this.bodyEl = h('tbody', '');
    this.buildAll();
    const weeks = Array.isArray(t('calendar.weeks')) ? t('calendar.weeks') : fallbackWeeks;
    this.el = h('div', 'x-spreadsheet-calendar')
      .children(
        h('div', 'calendar-header').children(
          this.headerLeftEl,
          h('div', 'calendar-header-right').children(
            h('a', 'calendar-prev')
              .on('click.stop', () => this.prev())
              .child(new Icon('chevron-left')),
            h('a', 'calendar-next')
              .on('click.stop', () => this.next())
              .child(new Icon('chevron-right')),
          ),
        ),
        h('table', 'calendar-body').children(
          h('thead', '').child(
            h('tr', '').children(
              ...weeks.map(week => h('th', 'cell').child(week)),
            ),
          ),
          this.bodyEl,
        ),
      );
    this.selectChange = () => {};
  }

  setValue(value) {
    this.value = toValidDate(value);
    this.cvalue = new Date(this.value.getTime());
    this.buildAll();
  }

  prev() {
    const { value } = this;
    addMonth(value, -1);
    this.buildAll();
  }

  next() {
    const { value } = this;
    addMonth(value, 1);
    this.buildAll();
  }

  buildAll() {
    this.buildHeaderLeft();
    this.buildBody();
  }

  buildHeaderLeft() {
    const { value } = this;
    const months = Array.isArray(t('calendar.months')) ? t('calendar.months') : fallbackMonths;
    this.headerLeftEl.el.textContent = `${months[value.getMonth()]} ${value.getFullYear()}`;
  }

  buildBody() {
    const { value, cvalue, bodyEl } = this;
    const mDays = monthDays(value.getFullYear(), value.getMonth(), cvalue);
    const trs = mDays.map((it) => {
      const tds = it.map((it1) => {
        let cls = 'cell';
        if (it1.disabled) cls += ' disabled';
        if (it1.active) cls += ' active';
        return h('td', '').child(
          h('div', cls)
            .on('click.stop', () => {
              this.selectChange(it1.d);
            })
            .child(it1.d.getDate().toString()),
        );
      });
      return h('tr', '').children(...tds);
    });
    bodyEl.html('').children(...trs);
  }
}
