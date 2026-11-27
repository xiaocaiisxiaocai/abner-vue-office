import Modal from './modal';
import FormInput from './form_input';
import FormSelect from './form_select';
import FormField from './form_field';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';

const fieldLabelWidth = 100;

export default class ModalValidation extends Modal {
  constructor() {
    const mf = new FormField(
      new FormSelect('cell',
        ['cell'], // cell|row|column
        '100%',
        it => t(`dataValidation.modeType.${it}`)),
      { required: true },
      `${t('dataValidation.range')}:`,
      fieldLabelWidth,
    );
    const rf = new FormField(
      new FormInput('120px', 'E3 or E3:F12'),
      { required: true, pattern: /^([A-Z]{1,3}[1-9]\d*)(:[A-Z]{1,3}[1-9]\d*)?$/ },
    );
    const cf = new FormField(
      new FormSelect('list',
        ['list', 'number', 'date', 'phone', 'email'],
        '100%',
        it => t(`dataValidation.type.${it}`),
        it => this.criteriaSelected(it)),
      { required: true },
      `${t('dataValidation.criteria')}:`,
      fieldLabelWidth,
    );

    // operator
    const of = new FormField(
      new FormSelect('be',
        ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
        '160px',
        it => t(`dataValidation.operator.${it}`),
        it => this.criteriaOperatorSelected(it)),
      { required: true },
    ).hide();
    // min, max
    const minvf = new FormField(
      new FormInput('70px', '10'),
      { required: true },
    ).hide();
    const maxvf = new FormField(
      new FormInput('70px', '100'),
      { required: true, type: 'number' },
    ).hide();
    // value
    const svf = new FormField(
      new FormInput('120px', 'a,b,c'),
      { required: true },
    );
    const vf = new FormField(
      new FormInput('70px', '10'),
      { required: true, type: 'number' },
    ).hide();

    super(t('contextmenu.validation'), [
      h('div', `${cssPrefix}-form-fields`).children(
        mf.el,
        rf.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        cf.el,
        of.el,
        minvf.el,
        maxvf.el,
        vf.el,
        svf.el,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('remove').on('click', () => this.btnClick('remove')),
        new Button('save', 'primary').on('click', () => this.btnClick('save')),
      ),
    ]);
    this.mf = mf;
    this.rf = rf;
    this.cf = cf;
    this.of = of;
    this.minvf = minvf;
    this.maxvf = maxvf;
    this.vf = vf;
    this.svf = svf;
    this.change = () => {};
  }

  hide() {
    if (this.mf && this.mf.input && this.mf.input.suggest) {
      this.mf.input.suggest.hide();
    }
    if (this.cf && this.cf.input && this.cf.input.suggest) {
      this.cf.input.suggest.hide();
    }
    if (this.of && this.of.input && this.of.input.suggest) {
      this.of.input.suggest.hide();
    }
    super.hide();
  }

  criteriaSelected(it) {
    const {
      of, minvf, maxvf, vf, svf,
    } = this;
    if (it === 'date' || it === 'number') {
      of.show();
      minvf.rule.type = it;
      maxvf.rule.type = it;
      if (it === 'date') {
        minvf.hint('2018-11-12');
        maxvf.hint('2019-11-12');
      } else {
        minvf.hint('10');
        maxvf.hint('100');
      }
      svf.hide();
      this.criteriaOperatorSelected(of.val() || 'be');
    } else {
      if (it === 'list') {
        svf.show();
      } else {
        svf.hide();
      }
      vf.hide();
      of.hide();
      minvf.hide();
      maxvf.hide();
    }
  }

  criteriaOperatorSelected(it) {
    if (!it) return;
    const {
      minvf, maxvf, vf,
    } = this;
    if (it === 'be' || it === 'nbe') {
      minvf.show();
      maxvf.show();
      vf.hide();
    } else {
      const type = this.cf.val();
      vf.rule.type = type;
      if (type === 'date') {
        vf.hint('2018-11-12');
      } else {
        vf.hint('10');
      }
      vf.show();
      minvf.hide();
      maxvf.hide();
    }
  }

  btnClick(action) {
    if (action === 'cancel') {
      this.hide();
    } else if (action === 'remove') {
      this.change('remove');
      this.hide();
    } else if (action === 'save') {
      // validate
      const attrs = ['mf', 'rf', 'cf', 'of', 'svf', 'vf', 'minvf', 'maxvf'];
      for (let i = 0; i < attrs.length; i += 1) {
        const field = this[attrs[i]];
        // console.log('field:', field);
        if (field.isShow()) {
          // console.log('it:', it);
          if (!field.validate()) return;
        }
      }

      const mode = this.mf.val();
      const ref = this.rf.val();
      const type = this.cf.val();
      const isRangeType = type === 'number' || type === 'date';
      const operator = isRangeType ? this.of.val() : undefined;
      let value = type === 'list' ? this.svf.val() : '';
      if (isRangeType) {
        if (operator === 'be' || operator === 'nbe') {
          value = [this.minvf.val(), this.maxvf.val()];
        } else {
          value = this.vf.val();
        }
      }
      // console.log(mode, ref, type, operator, value);
      this.change('save',
        mode,
        ref,
        {
          type, operator, required: false, value,
        });
      this.hide();
    }
  }

  // validation: { mode, ref, validator }
  setValue(v) {
    const {
      mf, rf, cf, of, svf, vf, minvf, maxvf,
    } = this;
    [mf, rf, cf, of, svf, vf, minvf, maxvf].forEach((field) => {
      if (field && typeof field.clearError === 'function') {
        field.clearError();
      }
    });
    if (v) {
      const {
        mode, ref, validator,
      } = v;
      const {
        type, operator, value,
      } = validator || { type: 'list' };
      const isRangeType = type === 'number' || type === 'date';
      const resolvedOperator = isRangeType ? (operator || 'be') : undefined;
      mf.val(mode || 'cell');
      rf.val(ref != null ? String(ref) : '');
      cf.val(type);
      if (isRangeType) {
        of.val(resolvedOperator);
      }
      if (Array.isArray(value)) {
        minvf.val(value[0] != null ? String(value[0]) : '');
        maxvf.val(value[1] != null ? String(value[1]) : '');
        svf.val('');
        vf.val('');
      } else {
        const strVal = value != null ? String(value) : '';
        svf.val(strVal);
        vf.val(strVal);
        minvf.val('');
        maxvf.val('');
      }
      this.criteriaSelected(type);
      if (isRangeType) {
        this.criteriaOperatorSelected(resolvedOperator);
      }
    }
    this.show();
  }
}
