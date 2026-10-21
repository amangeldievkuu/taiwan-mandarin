<script lang="ts" module>
  // Line icons on a 24px grid, drawn with the current text color.
  export const ICONS = {
    today:
      'M12 3.5v2M12 18.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3.5 12h2M18.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
    study:
      'M7 4.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8 2h8M9.5 11.5l2 2 3.5-4',
    path: 'M6 20.5c0-3 3-4 6-4s6-1 6-4-3-4-6-4-6-1-6-4M6 4.5h.01M18 20.5h.01M12 16.5h.01M12 8.5h.01',
    read: 'M3.5 5.5c2.5-1 5.5-1 8.5 1 3-2 6-2 8.5-1v13c-2.5-1-5.5-1-8.5 1-3-2-6-2-8.5-1zM12 6.5v13',
    dict: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.3 15.3 20 20M8 9h5M10.5 7v4M8.5 13l2-2 2 2',
    talk: 'M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2zM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01',
    me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1-3.5 4-5 7.5-5s6.5 1.5 7.5 5',
    speaker: 'M4.5 9.5h3l4.5-4v13l-4.5-4h-3zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
    back: 'M15 5l-7 7 7 7',
    forward: 'M9 5l7 7-7 7',
    close: 'M6 6l12 12M18 6 6 18',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.3 15.3 20 20',
    flame:
      'M12 21c3.6 0 6-2.4 6-5.8 0-3.6-2.6-5.6-3.7-8.7-.3 2-1.3 3-2.3 3.6.2-2.8-1-5.4-3.5-7.1.3 3.6-4.5 6-4.5 11.2C4 18.6 7.6 21 12 21Z',
    mic: 'M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3ZM6 11a6 6 0 0 0 12 0M12 17v3.5',
    pause: 'M8 5v14M16 5v14',
    play: 'M7.5 5.5v13l11-6.5z',
    pen: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7.5l3 3',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    sparkle:
      'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
    camera:
      'M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    send: 'M4.5 12h11M11 6.5l6 5.5-6 5.5',
    trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
    layers: 'M12 4 3.5 8.5 12 13l8.5-4.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  } as const;

  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    label?: string;
  }

  let { name, size = 20, label }: Props = $props();
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  style:width="{size}px"
  style:height="{size}px"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={ICONS[name]} />
</svg>
