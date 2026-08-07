import {Directive, ElementRef, Input, OnChanges, OnDestroy} from '@angular/core';

const SLOT_SELECTOR = '.clue-banner .clue-slot';
const SCALE = 1.15;
const FLIGHT_MS = 600;

/**
 * Lifts the live clue card out of the clue history stack and floats it over
 * the banner slot above the board. The card never leaves the history DOM —
 * it's just translated/scaled there — so when the turn ends, clearing the
 * transform glides it back into its natural spot at the top of the stack.
 */
@Directive({standalone: false, selector: '[clueFly]'})
export class ClueFlyDirective implements OnChanges, OnDestroy {
  @Input() clueFly = false;

  private readonly onResize = () => this.position(false);

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnChanges() {
    if (this.clueFly) {
      window.addEventListener('resize', this.onResize);
      // wait a frame so the banner slot for this turn is in the DOM
      requestAnimationFrame(() => this.clueFly && this.position(true));
    } else {
      window.removeEventListener('resize', this.onResize);
      this.land();
    }
  }

  /** Translate/scale the card from its stack position onto the banner slot */
  private position(animate: boolean) {
    const host = this.el.nativeElement;
    const slot = document.querySelector<HTMLElement>(SLOT_SELECTOR);

    // no slot (game over) or slot hidden (mobile layout) — stay in the stack
    if (!slot || !slot.offsetWidth) {
      this.land();
      return;
    }

    // measure the card's natural rect with the transform cleared; restored
    // synchronously below, so nothing ever paints mid-measurement
    const prevTransform = host.style.transform;
    host.style.transition = 'none';
    host.style.transform = 'none';
    const h = host.getBoundingClientRect();
    host.style.transform = prevTransform;
    void host.offsetWidth;  // flush so re-enabling the transition is clean

    const s = slot.getBoundingClientRect();
    const dx = s.left + s.width / 2 - (h.left + h.width / 2);
    const dy = s.top + s.height / 2 - (h.top + h.height / 2);

    host.classList.add('clue-flying');
    if (animate) {
      host.style.transition = '';
    }
    host.style.transform = `translate(${dx}px, ${dy}px) scale(${SCALE})`;
    if (!animate) {
      void host.offsetWidth;
      host.style.transition = '';
    }
  }

  /** Clear the transform so the card glides back into the stack */
  private land() {
    const host = this.el.nativeElement;
    host.style.transition = '';
    host.style.transform = '';

    if (!host.classList.contains('clue-flying')) {
      return;
    }

    // keep the elevated z-index/shadow until the flight home finishes
    const done = () => {
      host.classList.remove('clue-flying');
      host.removeEventListener('transitionend', done);
    };
    host.addEventListener('transitionend', done);
    setTimeout(done, FLIGHT_MS);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
  }
}
