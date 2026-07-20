import { Directive, HostListener } from '@angular/core';

type NameInput = HTMLInputElement | HTMLTextAreaElement;

const TEXT_TYPES = new Set(['', 'text']);
const FIELD_HINTS = [
  'name',
  'title',
  'person',
  'contact',
  'client',
  'customer',
  'staff',
  'service',
  'product',
  'brand',
  'salon',
  'business',
  'supplier',
  'vendor',
  'branch',
  'account',
  'group',
  'category',
  'recipe',
  'campaign',
  'competitor',
  'package',
  'skill'
];
const EXCLUDED_HINTS = [
  'amount',
  'barcode',
  'branchid',
  'cheque',
  'code',
  'date',
  'domain',
  'email',
  'gst',
  'hsn',
  'json',
  'login',
  'mobile',
  'month',
  'number',
  'otp',
  'pan',
  'password',
  'percent',
  'phone',
  'pin',
  'price',
  'query',
  'reference',
  'sac',
  'search',
  'sku',
  'slug',
  'token',
  'totp',
  'url',
  'upi'
];

@Directive({
  selector: '[appAutoNameCase]',
  standalone: true
})
export class AutoNameCaseDirective {
  private readonly selfDispatched = new WeakSet<NameInput>();

  @HostListener('document:input', ['$event'])
  onDocumentInput(event: Event): void {
    const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      ? event.target
      : null;
    if (!input || this.selfDispatched.has(input)) {
      if (input) this.selfDispatched.delete(input);
      return;
    }
    if (event instanceof InputEvent && event.isComposing) return;
    if (!this.shouldFormat(input)) return;

    const next = toNameCase(input.value);
    if (next === input.value) return;

    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    input.value = next;
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }

    this.selfDispatched.add(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private shouldFormat(input: NameInput): boolean {
    if (input.dataset['noAutoNameCase'] === 'true') return false;
    if (input.dataset['autoNameCase'] === 'true') return true;
    if (input instanceof HTMLInputElement && !TEXT_TYPES.has((input.type || '').toLowerCase())) return false;

    const key = [
      input.getAttribute('formControlName'),
      input.getAttribute('name'),
      input.id,
      input.getAttribute('placeholder'),
      input.getAttribute('aria-label')
    ].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');

    if (!key || key === 'id' || key.endsWith('id') || EXCLUDED_HINTS.some((hint) => key.includes(hint))) return false;
    return FIELD_HINTS.some((hint) => key.includes(hint));
  }
}

export function toNameCase(value: string): string {
  return value.replace(/[A-Za-z]+(?:['-][A-Za-z]+)*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
}
