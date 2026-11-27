import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Router, Route, Switch } from 'react-router-dom';
import TabContext from '@mui/lab/TabContext';
import { createMemoryHistory } from 'history';
import OrdersPage from './index';
import ordersPageReducer, { setPausedOrders } from './slice';
import PausedOrders from './PausedOrders';
import OrderService from '../../services/OrderService';
import { GlobalContext } from '../../hooks/useGlobals';
import { Order } from '../../../lib/types/order';
import { Member } from '../../../lib/types/member';
import { OrderStatus } from '../../../lib/enums/order.enum';
import { MemberStatus, MemberType } from '../../../lib/enums/member.enum';
import {
  ProductCollection,
  ProductSize,
  ProductStatus,
} from '../../../lib/enums/product.enum';
import { sweetErrorHandling } from '../../../lib/sweetAlert';

jest.mock('../../../lib/sweetAlert', () => ({
  sweetErrorHandling: jest.fn(() => Promise.resolve()),
}));

const member: Member = {
  _id: 'member-1',
  memberType: MemberType.USER,
  memberStatus: MemberStatus.ACTIVE,
  memberNick: 'Nick',
  memberPhone: '123456789',
  memberPoints: 0,
  createdAt: new Date('2025-01-01'),
  updateAt: new Date('2025-01-01'),
};

function order(orderStatus = OrderStatus.PAUSE): Order {
  return {
    _id: 'order-1',
    memberId: member._id,
    orderStatus,
    orderTotal: 29,
    orderDelivery: 5,
    createdAt: new Date('2025-01-01T12:30:00'),
    updatedAt: new Date('2025-01-02T13:45:00'),
    orderItems: [{
      _id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      itemPrice: 12,
      itemQuantity: 2,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    }],
    productData: [{
      _id: 'product-1',
      productName: 'Test Lavash',
      productStatus: ProductStatus.PROCESS,
      productCollection: ProductCollection.DISH,
      productPrice: 9,
      productLeftCount: 40,
      productSize: ProductSize.NORMAL,
      productVolume: 1,
      productImages: ['uploads/products/lavash.jpg'],
      productViews: 0,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    }],
  };
}

function TestGlobals({ children, authMember }: {
  children: React.ReactNode;
  authMember: Member | null;
}) {
  const [orderBuilder, setOrderBuilder] = useState(new Date());
  return (
    <GlobalContext.Provider value={{
      authMember,
      setAuthMember: jest.fn(),
      orderBuilder,
      setOrderBuilder,
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

let container: HTMLDivElement;
let root: Root;
let orders: Order[];
let updateOrder: jest.SpyInstance;
let getMyOrders: jest.SpyInstance;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  orders = [order()];
  const getComputedStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation(
    (element) => getComputedStyle.call(window, element)
  );
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  getMyOrders = jest.spyOn(OrderService.prototype, 'getMyOrders')
    .mockImplementation(async (inquiry) => orders.filter(
      (item) => item.orderStatus === inquiry.orderStatus
    ));
  updateOrder = jest.spyOn(OrderService.prototype, 'updateOrder')
    .mockImplementation(async (input) => {
      const updated = { ...orders[0], orderStatus: input.orderStatus };
      orders = [updated];
      return updated;
    });
  (sweetErrorHandling as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

async function mount(authMember: Member | null = member, pausedOnly = false) {
  const store = configureStore({
    reducer: { ordersPage: ordersPageReducer },
    middleware: (defaults) => defaults({ serializableCheck: false }),
  });
  if (pausedOnly) store.dispatch(setPausedOrders(orders));
  const history = createMemoryHistory({ initialEntries: ['/orders'] });
  await act(async () => {
    root.render(
      <Provider store={store}>
        <Router history={history}>
          <TestGlobals authMember={authMember}>
            <Switch>
              <Route path="/orders">
                {pausedOnly ? (
                  <TabContext value="1"><PausedOrders setValue={jest.fn()} /></TabContext>
                ) : <OrdersPage />}
              </Route>
              <Route path="/"><div>Home page</div></Route>
            </Switch>
          </TestGlobals>
        </Router>
      </Provider>
    );
  });
  return history;
}

async function click(selector: string) {
  await act(async () => fireEvent.click(container.querySelector(selector)!));
}

test('uses stored order prices and refreshes all tabs through payment and fulfilment', async () => {
  await mount();
  expect(container.querySelector('.title-dish')).toHaveTextContent('Test Lavash');
  expect(container.querySelector('.order-dish-img')).toHaveAttribute(
    'src', expect.stringContaining('/uploads/products/lavash.jpg')
  );
  expect(container.querySelector('.price-box')).toHaveTextContent('$122$24');
  expect(container.querySelector('.box-total')).toHaveTextContent(
    'Product price$24Delivery cost$5Total$29'
  );

  // Clicking nested button content must still send the button's order ID.
  const nested = document.createElement('span');
  container.querySelector('.pay-button')!.appendChild(nested);
  await act(async () => fireEvent.click(nested));

  expect(updateOrder).toHaveBeenLastCalledWith({
    orderId: 'order-1', orderStatus: OrderStatus.PROCESS,
  });
  expect(getMyOrders).toHaveBeenCalledTimes(6);
  expect(getByRole(container, 'tab', { name: 'PROCESS ORDERS' }))
    .toHaveAttribute('aria-selected', 'true');
  expect(container.querySelector('.data-compl'))
    .toHaveTextContent('2025-01-02 13:45');

  await click('.verify-button');

  expect(updateOrder).toHaveBeenLastCalledWith({
    orderId: 'order-1', orderStatus: OrderStatus.FINISH,
  });
  expect(getMyOrders).toHaveBeenCalledTimes(9);
  expect(getByRole(container, 'tab', { name: 'FINISHED ORDERS' }))
    .toHaveAttribute('aria-selected', 'true');
  expect(container.querySelector('.title-dish')).toHaveTextContent('Test Lavash');
  expect(container.querySelector('img[alt="No finished orders"]')).toBeNull();
});

test('declining confirmation keeps the paused order and never calls the API', async () => {
  await mount();
  (window.confirm as jest.Mock).mockReturnValue(false);
  await click('.cancel-button');
  await click('.pay-button');

  expect(updateOrder).not.toHaveBeenCalled();
  expect(getMyOrders).toHaveBeenCalledTimes(3);
  expect(container.querySelector('.title-dish')).toHaveTextContent('Test Lavash');
});

test('confirmed cancellation removes the paused order after refreshing', async () => {
  await mount();
  await click('.cancel-button');

  expect(updateOrder).toHaveBeenCalledWith({
    orderId: 'order-1', orderStatus: OrderStatus.DELETE,
  });
  expect(container.querySelector('.order-main-box')).toBeNull();
  expect(container.querySelector('img[alt="No paused orders"]')).not.toBeNull();
  expect(getMyOrders).toHaveBeenCalledTimes(6);
});

test('failed payment shows the error and keeps the current tab and order', async () => {
  const error = new Error('Update failed');
  updateOrder.mockRejectedValue(error);
  await mount();
  await click('.pay-button');

  expect(sweetErrorHandling).toHaveBeenCalledWith(error);
  expect(getMyOrders).toHaveBeenCalledTimes(3);
  expect(getByRole(container, 'tab', { name: 'PAUSED ORDERS' }))
    .toHaveAttribute('aria-selected', 'true');
  expect(container.querySelector('.title-dish')).toHaveTextContent('Test Lavash');
});

test('unauthenticated payment is rejected before confirmation or mutation', async () => {
  await mount(null, true);
  await click('.pay-button');

  expect(window.confirm).not.toHaveBeenCalled();
  expect(updateOrder).not.toHaveBeenCalled();
  expect(sweetErrorHandling).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Please login first!' })
  );
});

test('redirects unauthenticated order-page visits before loading orders', async () => {
  const history = await mount(null);
  expect(history.location.pathname).toBe('/');
  expect(getMyOrders).not.toHaveBeenCalled();
  expect(container.querySelector('.order-page')).toBeNull();
});

test('uses the restaurant badge for restaurant members', async () => {
  await mount({ ...member, memberType: MemberType.RESTAURANT });
  expect(container.querySelector('.order-user-icon-box img'))
    .toHaveAttribute('src', '/icons/restaurant.svg');
});
