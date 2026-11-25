import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Router, Route } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import ChosenProduct from './ChosenProduct';
import productsPageReducer, { setChosenProduct, setProducts } from './slice';
import homePageReducer from '../homePage/slice';
import ProductService from '../../services/ProductService';
import MemberService from '../../services/MemberService';
import { Product } from '../../../lib/types/product';
import {
  ProductCollection,
  ProductSize,
  ProductStatus,
} from '../../../lib/enums/product.enum';

jest.mock('swiper/react', () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('swiper', () => ({ FreeMode: {}, Navigation: {}, Thumbs: {} }));
jest.mock('swiper/css', () => ({}), { virtual: true });
jest.mock('swiper/css/free-mode', () => ({}), { virtual: true });
jest.mock('swiper/css/navigation', () => ({}), { virtual: true });
jest.mock('swiper/css/thumbs', () => ({}), { virtual: true });

function product(id: string, productViews = 0): Product {
  return {
    _id: id,
    productName: `Product ${id}`,
    productStatus: ProductStatus.PROCESS,
    productCollection: ProductCollection.DISH,
    productPrice: 12,
    productLeftCount: 40,
    productSize: ProductSize.NORMAL,
    productVolume: 1,
    productImages: [`uploads/products/${id}.jpg`],
    productViews,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;
let getProduct: jest.SpyInstance;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  getProduct = jest.spyOn(ProductService.prototype, 'getProduct');
  jest.spyOn(MemberService.prototype, 'getRestaurant').mockResolvedValue(null as any);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

function mount(initialProduct?: Product, cachedProducts: Product[] = []) {
  const store = configureStore({
    reducer: { productsPage: productsPageReducer, homePage: homePageReducer },
    middleware: (defaults) => defaults({ serializableCheck: false }),
  });
  if (initialProduct) store.dispatch(setChosenProduct(initialProduct));
  store.dispatch(setProducts(cachedProducts));
  const history = createMemoryHistory({ initialEntries: ['/products/a'] });
  act(() => {
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <Router history={history}>
            <Route path="/products/:productId">
              <ChosenProduct onAdd={jest.fn()} />
            </Route>
          </Router>
        </Provider>
      </React.StrictMode>
    );
  });
  return { store, history };
}

test('hides the previous item while loading and makes one request under StrictMode', async () => {
  const response = deferred<Product>();
  getProduct.mockReturnValue(response.promise);
  mount(product('old'));

  expect(container.textContent).not.toContain('Product old');
  expect(container.querySelector('.slider-image')).toBeNull();
  expect(container.querySelector('[aria-label="Loading product"]')).not.toBeNull();
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
  expect(getProduct).toHaveBeenCalledTimes(1);

  await act(async () => response.resolve(product('a', 1)));

  expect(container.querySelector('.slider-image')).toHaveAttribute(
    'src',
    expect.stringContaining('/uploads/products/a.jpg')
  );
  expect(container.querySelector('.product-name')).toHaveTextContent('Product a');
  expect(container.querySelector('.product-view')).toHaveTextContent('1');
});

test('a late response for the previous route cannot replace the current product', async () => {
  const first = deferred<Product>();
  const second = deferred<Product>();
  getProduct.mockImplementation((id: string) => id === 'a' ? first.promise : second.promise);
  const { history, store } = mount();

  act(() => history.push('/products/b'));
  await act(async () => second.resolve(product('b')));
  expect(container.querySelector('.product-name')).toHaveTextContent('Product b');

  await act(async () => first.resolve(product('a')));
  expect(container.querySelector('.product-name')).toHaveTextContent('Product b');
  expect(store.getState().productsPage.choosenProduct?._id).toBe('b');
  expect(getProduct.mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
});

test('switching from a loaded item hides its image until the next item arrives', async () => {
  const second = deferred<Product>();
  getProduct.mockResolvedValueOnce(product('a')).mockReturnValueOnce(second.promise);
  const { history } = mount();
  await act(async () => {});
  expect(container.querySelector('.product-name')).toHaveTextContent('Product a');

  act(() => history.push('/products/b'));
  expect(container.querySelector('.slider-image')).toBeNull();
  expect(container.textContent).not.toContain('Product a');

  await act(async () => second.resolve(product('b')));
  expect(container.querySelector('.slider-image')).toHaveAttribute(
    'src',
    expect.stringContaining('/uploads/products/b.jpg')
  );
});

test('a return visit refreshes details and keeps the server unique view count', async () => {
  getProduct.mockResolvedValue(product('a', 1));
  const { history } = mount();
  await act(async () => {});
  expect(container.querySelector('.product-view')).toHaveTextContent('1');

  act(() => history.push('/products'));
  act(() => history.push('/products/a'));
  await act(async () => {});

  expect(getProduct).toHaveBeenCalledTimes(2);
  expect(container.querySelector('.product-view')).toHaveTextContent('1');
});

test('renders the clicked card immediately while refreshing its view count', async () => {
  const response = deferred<Product>();
  getProduct.mockReturnValue(response.promise);
  const { store } = mount(product('old'), [product('a')]);

  expect(container.querySelector('.product-name')).toHaveTextContent('Product a');
  expect(container.querySelector('.slider-image')).toHaveAttribute(
    'src', expect.stringContaining('/uploads/products/a.jpg')
  );
  expect(container.querySelector('[aria-label="Loading product"]')).toBeNull();
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
  expect(container.textContent).not.toContain('Product old');

  await act(async () => response.resolve(product('a', 1)));
  expect(container.querySelector('.product-view')).toHaveTextContent('1');
  expect(store.getState().productsPage.products[0].productViews).toBe(1);
});

test('switches between cached products without waiting for either request', async () => {
  const first = deferred<Product>();
  const second = deferred<Product>();
  getProduct.mockImplementation((id: string) => id === 'a' ? first.promise : second.promise);
  const { history } = mount(undefined, [product('a'), product('b')]);

  expect(container.querySelector('.product-name')).toHaveTextContent('Product a');
  act(() => history.push('/products/b'));
  expect(container.querySelector('.product-name')).toHaveTextContent('Product b');
  expect(container.querySelector('[aria-label="Loading product"]')).toBeNull();

  await act(async () => {
    second.resolve(product('b', 1));
    first.resolve(product('a', 1));
  });
  expect(container.querySelector('.product-name')).toHaveTextContent('Product b');
});

test('a failed request shows an error without leaving the old product visible', async () => {
  const response = deferred<Product>();
  getProduct.mockReturnValue(response.promise);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mount(product('old'));

  await act(async () => response.reject(new Error('Request failed')));

  expect(container.querySelector('[role="alert"]')).toHaveTextContent('Unable to load');
  expect(container.querySelector('.slider-image')).toBeNull();
  expect(container.textContent).not.toContain('Product old');
});
