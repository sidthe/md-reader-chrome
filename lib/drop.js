// Directory drag-and-drop: the File System Access API's second grant path.
// Drops bypass the picker dialog entirely (and the enterprise-scan hook that
// can wedge it); dropped handles arrive with read permission granted.
export function makeDirectoryDropTarget(el, { onDirectory, onError }) {
  let depth = 0;
  const clear = () => {
    depth = 0;
    el.classList.remove('drop-hover');
  };
  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    el.classList.add('drop-hover');
  });
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('dragleave', () => {
    if (--depth <= 0) clear();
  });
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    clear();
    const item = [...(e.dataTransfer?.items || [])].find((i) => i.kind === 'file');
    if (!item?.getAsFileSystemHandle) {
      onError?.('Nothing droppable here — drag a folder from Finder/Explorer.');
      return;
    }
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle?.kind !== 'directory') {
        onError?.(`“${handle?.name || 'that'}” is a file — drop a folder.`);
        return;
      }
      onDirectory(handle);
    } catch (err) {
      onError?.(`${err?.name || 'Error'}: ${err?.message || err}`);
    }
  });
}
