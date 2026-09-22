export type ScrollWorldSection = {
  id: string; label: string; still: string; stillMobile?: string; clip?: string; clipMobile?: string; framesMobile?: { base: string; count: number; fps: number };
  accent?: string; scroll?: number; linger?: number; eyebrow?: string; title?: string; body?: string; tags?: string[];
  cta?: { primary?: { label: string; href: string }; secondary?: { label: string; href: string } };
};
export type ScrollWorldConfig = {
  brand?: { name: string; href?: string };
  cta?: { label: string; href: string };
  hint?: string; nav?: boolean; atmosphere?: boolean;
  diveScroll?: number; connScroll?: number; crossfade?: number;
  sections: ScrollWorldSection[];
  connectors?: (string | null)[];
  connectorsMobile?: (string | null)[];
  connectorsFramesMobile?: ({ base: string; count: number; fps: number } | null)[];
};
export function mountScrollWorld(container: HTMLElement, config: ScrollWorldConfig): void;
