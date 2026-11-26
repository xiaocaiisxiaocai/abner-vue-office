export function isTest(){
    return typeof location !== 'undefined' && typeof location.href === 'string' && location.href.includes('test');
}