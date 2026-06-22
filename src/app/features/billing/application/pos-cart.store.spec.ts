import { PosCartStore } from './pos-cart.store';

describe('PosCartStore', () => {
  it('adds and totals POS cart items', () => {
    const store = new PosCartStore();
    store.add({ item_type: 'service', item_name: 'Hair spa', quantity: 2, unit_price: 500, tax_rate: 18 });
    expect(store.subtotal()).toBe(1000);
    expect(store.tax()).toBe(180);
    expect(store.total()).toBe(1180);
  });

  it('removes cart items', () => {
    const store = new PosCartStore();
    store.add({ item_type: 'product', item_name: 'Serum', quantity: 1, unit_price: 300, tax_rate: 18 });
    store.remove(0);
    expect(store.items().length).toBe(0);
  });
});
