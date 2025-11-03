export const products = [
  {
    barcode: '000000000001',
    name: 'Cerveza Rubia',
    price: 2500,
    image: '/images/cerveza-rubia.svg',
  },
  {
    barcode: '000000000002',
    name: 'Gaseosa 500ml',
    price: 1800,
    image: '/images/gaseosa.svg',
  },
  {
    barcode: '000000000003',
    name: 'Snack Salado',
    price: 1500,
    image: '/images/snack.svg',
  },
  {
    barcode: '000000000099',
    name: 'Varios',
    price: null,
    image: '/images/varios.svg',
  },
];

export function findProductByBarcode(barcode) {
  return products.find((product) => product.barcode === barcode);
}
