export interface OverlayOptions {
  fontSize: "small" | "medium" | "large";
  opacity: number;
}

const FONT_SIZE_MAP = {
  small: "14px",
  medium: "18px",
  large: "22px",
} as const;

export class TranslationOverlay {
  private container: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private options: OverlayOptions;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private isFullscreen = false;

  constructor(options: OverlayOptions) {
    this.options = options;
  }

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    this.container.id = "yt-subtitle-overlay";
    this.container.setAttribute("data-yt-translator", "1");

    this.textEl = document.createElement("div");
    this.textEl.className = "yt-subtitle-text";

    this.container.appendChild(this.textEl);
    this.applyStyles();
    this.attach();

    // Handle fullscreen toggling
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    window.addEventListener("resize", this.repositionDebounced);

    this.resizeObserver = new ResizeObserver(this.repositionDebounced);
    const videoEl = document.querySelector("video");
    if (videoEl) this.resizeObserver.observe(videoEl);
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
    this.textEl = null;
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    window.removeEventListener("resize", this.repositionDebounced);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  show(text: string, partial = false): void {
    if (!this.textEl || !this.container) return;
    this.textEl.textContent = partial ? text + " …" : text;
    this.container.classList.remove("yt-subtitle-hidden");
    this.container.classList.toggle("yt-subtitle-partial", partial);
    this.clearHideTimer();
    if (!partial) {
      this.hideTimer = setTimeout(() => this.hide(), 5000);
    }
  }

  hide(): void {
    this.container?.classList.add("yt-subtitle-hidden");
    if (this.textEl) this.textEl.textContent = "";
    this.clearHideTimer();
  }

  updateOptions(options: Partial<OverlayOptions>): void {
    this.options = { ...this.options, ...options };
    this.applyStyles();
  }

  private applyStyles(): void {
    if (!this.container) return;
    const opacity = this.options.opacity;
    const fontSize = FONT_SIZE_MAP[this.options.fontSize];

    this.container.style.cssText = `
      position: absolute;
      bottom: 10%;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      max-width: 80%;
      pointer-events: none;
    `;

    if (this.textEl) {
      this.textEl.style.cssText = `
        background: rgba(0, 0, 0, ${opacity});
        color: #fff;
        font-size: ${fontSize};
        font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
        line-height: 1.5;
        padding: 6px 14px;
        border-radius: 4px;
        text-align: center;
        white-space: pre-wrap;
        transition: opacity 0.15s ease;
      `;
    }
  }

  private attach(): void {
    const player = document.querySelector(".html5-video-player") as HTMLElement | null;
    const parent = player ?? document.body;
    if (player) {
      const pos = getComputedStyle(player).position;
      if (pos === "static") player.style.position = "relative";
    }
    parent.appendChild(this.container!);
    this.reposition();
  }

  private reposition(): void {
    // Position is handled by CSS (bottom: 10% relative to the player container)
  }

  private repositionDebounced = (): void => {
    requestAnimationFrame(() => this.reposition());
  };

  private onFullscreenChange = (): void => {
    this.isFullscreen = !!document.fullscreenElement;
    if (this.container) {
      this.container.remove();
      this.attach();
    }
  };

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
