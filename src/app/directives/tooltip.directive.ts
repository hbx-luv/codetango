import { Directive, Input, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[tooltip]'
})
export class TooltipDirective {
  @Input() tooltip: string;
  @Input() placement: string = 'bottom';
  @Input() delay: number = 0;
  @Input() width?: number;

  tooltipElement: HTMLElement;
  offset = 10;

  constructor(private el: ElementRef, private renderer: Renderer2) {
    this.setGlobalStyles();
  }

  @HostListener('mouseenter') onMouseEnter() {
    if (!this.tooltipElement) { this.show(); }
  }

  @HostListener('mouseleave') onMouseLeave() {
    if (this.tooltipElement) { this.hide(); }
  }

  show() {
    this.create();
    this.setPosition();
    this.renderer.addClass(this.tooltipElement, 'ng-tooltip-show');
  }

  hide() {
    this.renderer.removeClass(this.tooltipElement, 'ng-tooltip-show');
    window.setTimeout(() => {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }, this.delay);
  }

  create() {
    if (this.tooltip && this.tooltip.startsWith('http')) {
      this.createImg();
    } else {
      this.createText();
    }
  }
  createClassAndDelay() {
    this.renderer.addClass(this.tooltipElement, 'ng-tooltip');
    this.renderer.addClass(this.tooltipElement, `ng-tooltip-${this.placement}`);

    // delay
    this.renderer.setStyle(this.tooltipElement, '-webkit-transition', `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltipElement, '-moz-transition', `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltipElement, '-o-transition', `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltipElement, 'transition', `opacity ${this.delay}ms`);
  }

  createText() {
    this.tooltipElement = this.renderer.createElement('span');

    this.renderer.appendChild(
      this.tooltipElement,
      this.renderer.createText(this.tooltip) // textNode
    );

    this.renderer.appendChild(document.body, this.tooltipElement);
    // this.renderer.appendChild(this.el.nativeElement, this.tooltip);

    this.createClassAndDelay();
  }

  createImg() {
    this.tooltipElement = this.renderer.createElement('ion-img');

    this.renderer.setAttribute(this.tooltipElement, 'src', this.tooltip);

    this.renderer.appendChild(document.body, this.tooltipElement);

    this.createClassAndDelay();
  }

  setPosition() {
    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement.getBoundingClientRect();
    const scrollPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    let top;
    let left;
    const tooltipWidth = this.width || tooltipPos.width;

    if (this.placement === 'top') {
      top = hostPos.top - tooltipPos.height - this.offset;
      left = hostPos.left + (hostPos.width - tooltipWidth) / 2;
    }

    if (this.placement === 'bottom') {
      top = hostPos.bottom + this.offset;
      left = hostPos.left + (hostPos.width - tooltipWidth) / 2;
    }

    if (this.placement === 'left') {
      top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
      left = hostPos.left - tooltipWidth - this.offset;
    }

    if (this.placement === 'right') {
      top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
      left = hostPos.right + this.offset;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top + scrollPos}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  setGlobalStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      .tooltip-example {
        text-align: center;
        padding: 0 50px;
      }
      .tooltip-example [tooltip] {
        display: inline-block;
        margin: 50px 20px;
        width: 180px;
        height: 50px;
        border: 1px solid gray;
        border-radius: 5px;
        line-height: 50px;
        text-align: center;
      }
      .ng-tooltip {
        position: absolute;
        max-width: 150px;
        font-size: 14px;
        text-align: center;
        color: #f8f8f2;
        padding: 3px 8px;
        background: #282a36;
        border-radius: 4px;
        z-index: 1000;
        opacity: 0;
      }
      .ng-tooltip:after {
        content: "";
        position: absolute;
        border-style: solid;
      }
      .ng-tooltip-top:after {
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-color: black transparent transparent transparent;
      }
      .ng-tooltip-bottom:after {
        bottom: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-color: transparent transparent black transparent;
      }
      .ng-tooltip-left:after {
        top: 50%;
        left: 100%;
        margin-top: -5px;
        border-width: 5px;
        border-color: transparent transparent transparent black;
      }
      .ng-tooltip-right:after {
        top: 50%;
        right: 100%;
        margin-top: -5px;
        border-width: 5px;
        border-color: transparent black transparent transparent;
      }
      .ng-tooltip-show {
        opacity: 1;
      }
    `;

    document.head.appendChild(style);
  }
}
