export function readOnlyInput(root){
    if(root && typeof root.querySelectorAll === 'function'){
        let nodes = root.querySelectorAll('input');
        for(let node of nodes){
            node && !node.readOnly && (node.readOnly = true);
        }
        typeof document !== 'undefined' &&
            document.activeElement &&
            document.activeElement.tagName === 'INPUT' &&
            typeof root.contains === 'function' &&
            root.contains(document.activeElement) &&
            typeof document.activeElement.blur === 'function' &&
            document.activeElement.blur();
    }
}