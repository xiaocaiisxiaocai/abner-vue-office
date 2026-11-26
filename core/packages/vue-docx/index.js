import './src/hack';
import AbnerVueOfficeDocx from './src/main.vue';

AbnerVueOfficeDocx.install = function (Vue) {
    Vue.component(AbnerVueOfficeDocx.name, AbnerVueOfficeDocx);
};

export default AbnerVueOfficeDocx;
