import Dropdown from '../dropdown';
import DropdownItem from './dropdown_item';

import { cssPrefix } from '../../config';
import { h } from '../element';
import Icon from '../icon';

class DropdownMore extends Dropdown {
  constructor() {
    const icon = new Icon('ellipsis');
    const moreBtns = h('div', `${cssPrefix}-toolbar-more`);
    super(icon, 'auto', false, 'bottom-right', moreBtns);
    this.moreBtns = moreBtns;
    this.childDropdowns = [];
    this.contentEl.css('max-width', '420px');
  }

  hide() {
    if (Array.isArray(this.childDropdowns)) {
      this.childDropdowns.forEach((d) => {
        if (d && typeof d.hide === 'function') d.hide();
      });
    }
    super.hide();
  }
}

export default class More extends DropdownItem {
  constructor() {
    super('more');
    this.el.hide();
  }

  dropdown() {
    return new DropdownMore();
  }

  show() {
    this.el.show();
  }

  hide() {
    if (this.dd && typeof this.dd.hide === 'function') {
      this.dd.hide();
    }
    this.el.hide();
  }
}
