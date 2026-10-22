// Toasts: short messages that slide in and leave by themselves (a mended bowl, a new seal).

export interface Toast {
  id: number;
  kind: 'mend' | 'bowl' | 'seal' | 'info';
  title: string;
  body?: string;
  /** A seal's characters (kind "seal"). */
  seal?: string;
}

let next = 0;

class Toasts {
  items = $state<Toast[]>([]);

  show(toast: Omit<Toast, 'id'>, ms = 4200): void {
    const id = next++;
    this.items = [...this.items, { ...toast, id }].slice(-3);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
