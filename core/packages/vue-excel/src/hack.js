export function readOnlyInput(root){
    if(root){
        let nodes = root.querySelectorAll('input');
        for(let node of nodes){
            node && !node.readOnly && (node.readOnly = true);
        }
        typeof document !== 'undefined' && document.activeElement && typeof root.contains === 'function' && root.contains(document.activeElement) && document.activeElement.blur();
    }
}