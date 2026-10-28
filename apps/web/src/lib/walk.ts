// Drives the welcome page's bot from the scroll position: `--p` (0–1, how far down the page),
// `--dir` (1 forward, -1 back) and the classes `walking` while the page moves, `sitting` once it
// stops and `sleepy` after a longer pause. A Svelte action; the CSS does the drawing.

const IDLE_MS = 900;
const SLEEPY_MS = 4000;

export function walk(node: HTMLElement): { destroy(): void } {
  let lastY = scrollY;
  let frame = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let sleepy: ReturnType<typeof setTimeout> | undefined;

  const rest = () => {
    node.classList.remove('walking', 'fast');
    node.classList.add('sitting');
    sleepy = setTimeout(() => node.classList.add('sleepy'), SLEEPY_MS);
  };

  const update = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    const dy = scrollY - lastY;
    lastY = scrollY;
    node.style.setProperty('--p', p.toFixed(4));
    if (dy !== 0) node.style.setProperty('--dir', dy < 0 ? '-1' : '1');
    node.classList.toggle('fast', Math.abs(dy) > 48);
    node.classList.add('walking');
    node.classList.remove('sitting', 'sleepy');
    clearTimeout(idle);
    clearTimeout(sleepy);
    idle = setTimeout(rest, IDLE_MS);
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  return {
    destroy() {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      clearTimeout(sleepy);
    },
  };
}
