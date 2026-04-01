import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

/** Toggles host opacity on random intervals (April Fools blink tiles). */
@Directive({
  selector: '[appRandomBlink]',
})
export class RandomBlinkDirective implements OnChanges, OnDestroy {
  @Input() appRandomBlink = false;

  private timeoutId: ReturnType<typeof setTimeout>|null = null;
  private dimmed = false;

  constructor(
      private readonly el: ElementRef<HTMLElement>,
      private readonly renderer: Renderer2,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['appRandomBlink']) {
      return;
    }
    this.stop();
    if (this.appRandomBlink) {
      this.dimmed = false;
      this.renderer.setStyle(this.el.nativeElement, 'opacity', '1');
      this.scheduleNext();
    }
  }

  ngOnDestroy() {
    this.stop();
  }

  private stop() {
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.renderer.removeStyle(this.el.nativeElement, 'opacity');
  }

  private scheduleNext() {
    if (!this.appRandomBlink) {
      return;
    }
    const minMs = this.dimmed ? 120 : 220;
    const maxMs = this.dimmed ? 1600 : 2600;
    const delay = minMs + Math.random() * (maxMs - minMs);
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.dimmed = !this.dimmed;
      this.renderer.setStyle(
          this.el.nativeElement, 'opacity', this.dimmed ? '0.3' : '1');
      this.scheduleNext();
    }, delay);
  }
}
