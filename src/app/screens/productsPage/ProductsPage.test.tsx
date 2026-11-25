import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Router, Route } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import ProductsPage from './index';
import productsPageReducer from './slice';
import homePageReducer from '../homePage/slice';
import ProductService from '../../services/ProductService';
import { Product, ProductInquiry } from '../../../lib/types/product';
import {
  ProductCollection,
  ProductSize,
  ProductStatus,
} from '../../../lib/enums/product.enum';

jest.mock('./ChosenProduct', () => () => <div data-testid="product-detail">Product detail</div>);

let container: HTMLDivElement;
let root: Root;
let getProducts: jest.SpyInstance;

function result(inquiry: ProductInquiry): Product {
  const category = inquiry.productCollection ?? ProductCollection.DISH;
  return {
    _id: `${category.toLowerCase()}-${inquiry.page}`,
    productName: `${category} product ${inquiry.page}`,
    productStatus: ProductStatus.PROCESS,
    productCollection: category,
    productPrice: 8,
    productLeftCount: 40,
    productSize: ProductSize.NORMAL,
    productVolume: 1,
    productImages: ['uploads/products/test.jpg'],
    productViews: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // The older jsdom version cannot inspect pseudo-elements for role queries.
  const getComputedStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation(
    (element) => getComputedStyle.call(window, element)
  );
  getProducts = jest.spyOn(ProductService.prototype, 'getProducts')
    .mockImplementation(async (inquiry) => [result(inquiry)]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

async function mount() {
  const history = createMemoryHistory({ initialEntries: ['/products'] });
  const store = configureStore({
    reducer: { productsPage: productsPageReducer, homePage: homePageReducer },
    middleware: (defaults) => defaults({ serializableCheck: false }),
  });
  await act(async () => {
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <Router history={history}>
            <Route path="/products">
              <ProductsPage onAdd={jest.fn()} />
            </Route>
          </Router>
        </Provider>
      </React.StrictMode>
    );
  });
  return history;
}

async function clickButton(name: string) {
  await act(async () => {
    fireEvent.click(getByRole(container, 'button', { name, exact: true }));
  });
}

async function openProduct() {
  await act(async () => {
    fireEvent.click(container.querySelector('.product-card')!);
  });
  expect(container.querySelector('[data-testid="product-detail"]')).not.toBeNull();
}

test.each([
  ['Dessert', ProductCollection.DESSERT],
  ['Drink', ProductCollection.DRINK],
])('Back from a %s product restores that category instead of Dish', async (label, category) => {
  const history = await mount();
  await clickButton(label);
  await openProduct();
  expect(history.location.pathname).toBe(`/products/${category.toLowerCase()}-1`);

  await act(async () => history.goBack());

  expect(history.location.pathname).toBe('/products');
  expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({
    productCollection: category, page: 1,
  }));
  expect(getByRole(container, 'button', { name: label, exact: true }))
    .toHaveClass('MuiButton-containedPrimary');
  expect(container.querySelector('.product-title')).toHaveTextContent(`${category} product 1`);
});

test('Back also retains the selected page, sort order, and submitted search', async () => {
  const history = await mount();
  await clickButton('Dessert');
  await clickButton('Price');
  await act(async () => {
    fireEvent.change(getByRole(container, 'searchbox'), { target: { value: 'cake' } });
  });
  await clickButton('Search');
  await clickButton('Go to page 2');
  await openProduct();

  await act(async () => history.goBack());

  expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({
    productCollection: ProductCollection.DESSERT,
    page: 2,
    order: 'productPrice',
    search: 'cake',
  }));
  expect(getByRole(container, 'searchbox')).toHaveValue('cake');
  expect(getByRole(container, 'button', { name: 'Price', exact: true }))
    .toHaveClass('MuiButton-containedPrimary');
  expect(getByRole(container, 'button', { name: 'page 2', exact: true }))
    .toHaveAttribute('aria-current', 'true');
  expect(container.querySelector('.product-title')).toHaveTextContent('DESSERT product 2');
});
