import { useEffect, useRef } from 'react';

/** Scale sidebar nav content to fit available height without scrolling. Disabled during customize (breaks HTML5 DnD). */
export function useSidebarFit(groups: unknown, customizing: boolean) {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return;

    const fit = () => {
      content.style.transform = 'none';
      content.style.width = '100%';
      content.style.height = 'auto';

      if (customizing) {
        shell.style.setProperty('--sidebar-nav-scale', '1');
        shell.style.overflowY = 'auto';
        return;
      }

      shell.style.overflowY = 'hidden';
      const available = shell.clientHeight;
      const needed = content.scrollHeight;
      if (needed <= available || available <= 0) {
        shell.style.setProperty('--sidebar-nav-scale', '1');
        return;
      }

      const scale = Math.max(0.52, available / needed);
      content.style.transform = `scale(${scale})`;
      content.style.transformOrigin = 'top left';
      content.style.width = `${100 / scale}%`;
      shell.style.setProperty('--sidebar-nav-scale', String(scale));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(shell);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [groups, customizing]);

  return { shellRef, contentRef };
}
