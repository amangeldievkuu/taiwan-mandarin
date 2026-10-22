<script lang="ts">
  // Bursts of plum blossoms (梅花, Taiwan's flower) for a finished session, gold dust for a mended
  // bowl, drawn on one canvas over the app. Nothing is drawn under reduced motion (see
  // celebrate.svelte.ts), and the frame loop stops as soon as the last petal has fallen.
  import { celebrate, type Burst } from '../lib/celebrate.svelte';

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    turn: number;
    spin: number;
    size: number;
    color: string;
    blossom: boolean;
    age: number;
    life: number;
    sway: number;
  }

  let canvas = $state<HTMLCanvasElement>();
  let particles: Particle[] = [];
  let frame = 0;

  $effect(() => {
    for (const burst of celebrate.bursts) {
      spawn(burst);
      celebrate.burstDone(burst.id);
    }
  });

  function colors(kind: Burst['kind']): string[] {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string) => css.getPropertyValue(name).trim();
    return kind === 'gold'
      ? ['#fff1b8', '#f2c14e', '#e0a526', '#b9831a', '#fff8dc']
      : [
          '#f7a8b8',
          '#f48ba0',
          get('--seal'),
          '#ffd1dc',
          get('--gold'),
          get('--jade'),
          get('--sky'),
        ];
  }

  function spawn(burst: Burst): void {
    if (!canvas) return;
    resize();
    const palette = colors(burst.kind);
    const gold = burst.kind === 'gold';
    const x = burst.x ?? innerWidth / 2;
    const y = burst.y ?? innerHeight * 0.3;
    const count = gold ? 70 : 120;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (gold ? Math.PI * 2 : Math.PI * 1.3);
      const speed = (gold ? 2 : 5) + Math.random() * (gold ? 5 : 8);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        turn: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        size: gold ? 1.5 + Math.random() * 2.5 : 5 + Math.random() * 6,
        color: palette[Math.floor(Math.random() * palette.length)] ?? '#f7a8b8',
        blossom: !gold && Math.random() < 0.7,
        age: 0,
        life: 80 + Math.random() * 70,
        sway: Math.random() * Math.PI * 2,
      });
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function resize(): void {
    if (!canvas) return;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(innerWidth * ratio);
    const height = Math.round(innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function tick(): void {
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      frame = 0;
      return;
    }
    const ratio = canvas.width / innerWidth;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => p.age < p.life);
    for (const p of particles) {
      p.age++;
      p.vy += p.blossom ? 0.09 : 0.06;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.sway += 0.08;
      p.x += p.vx + (p.blossom ? Math.sin(p.sway) * 0.6 : 0);
      p.y += p.vy;
      p.turn += p.spin;
      context.globalAlpha = Math.min(1, (p.life - p.age) / 30);
      context.fillStyle = p.color;
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.turn);
      if (p.blossom) {
        // Five round petals and a gold heart.
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          context.beginPath();
          context.arc(Math.cos(a) * p.size * 0.5, Math.sin(a) * p.size * 0.5, p.size * 0.42, 0, 7);
          context.fill();
        }
        context.fillStyle = '#f2c14e';
        context.beginPath();
        context.arc(0, 0, p.size * 0.22, 0, 7);
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, p.size, 0, 7);
        context.fill();
      }
      context.restore();
    }
    context.globalAlpha = 1;
    frame = particles.length ? requestAnimationFrame(tick) : 0;
    if (!frame) context.clearRect(0, 0, innerWidth, innerHeight);
  }

  $effect(() => () => cancelAnimationFrame(frame));
</script>

<svelte:window onresize={resize} />

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 60;
    pointer-events: none;
  }
</style>
