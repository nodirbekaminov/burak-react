import React from 'react';
import moment from 'moment';
import { Box, Stack } from '@mui/material';
import Button from '@mui/material/Button';
import TabPanel from '@mui/lab/TabPanel';

import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { retrieveProcessOrders } from './selector';
import { Product } from '../../../lib/types/product';
import { Messages, serverApi } from '../../../lib/config';
import { Order, OrderItem, OrderUpdateInput } from '../../../lib/types/order';
import { OrderStatus } from '../../../lib/enums/order.enum';
import { sweetErrorHandling } from '../../../lib/sweetAlert';
import { useGlobals } from '../../hooks/useGlobals';
import OrderService from '../../services/OrderService';

const processOrdersRetreiver = createSelector(
  retrieveProcessOrders,
  (processOrders) => ({ processOrders })
);

interface ProcessOrdersProps {
  setValue: (value: string) => void;
}

export default function ProcessOrders({ setValue }: ProcessOrdersProps) {
  const { processOrders } = useSelector(processOrdersRetreiver);
  const { authMember, setOrderBuilder } = useGlobals();

  /** HANDLERS **/
  const finishOrderHandler = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      if (!authMember) throw new Error(Messages.error2);
      const input: OrderUpdateInput = {
        orderId: e.currentTarget.value,
        orderStatus: OrderStatus.FINISH,
      };
      if (!window.confirm('Do you want to fulfil the order?')) return;

      await new OrderService().updateOrder(input);
      setValue('3');
      setOrderBuilder(new Date());
    } catch (err) {
      console.log(err);
      sweetErrorHandling(err).then();
    }
  };

  return (
    <TabPanel value={'2'}>
      <Stack>
        {processOrders.map((order: Order) => {
          return (
            <Box key={order._id} className={'order-main-box'}>
              <Box className={'order-box-scroll'}>
                {order?.orderItems?.map((item: OrderItem) => {
                  const product: Product = order.productData.filter(
                    (ele: Product) => item.productId === ele._id
                  )[0];
                  if (!product) return null;
                  const imagePath = `${serverApi}/${product.productImages[0]}`;
                  return (
                    <Box key={item._id} className={'orders-name-price'}>
                      <img
                        src={imagePath}
                        alt={product.productName}
                        className={'order-dish-img'}
                      />
                      <p className={'title-dish'}>{product.productName}</p>
                      <Box className={'price-box'}>
                        <p>${item.itemPrice}</p>
                        <img src={'/icons/close.svg'} alt="" />
                        <p>{item.itemQuantity}</p>
                        <img src={'/icons/pause.svg'} alt="" />
                        <p style={{ marginLeft: '15px' }}>
                          ${item.itemQuantity * item.itemPrice}
                        </p>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Box className={'total-price-box'}>
                <Box className={'box-total'}>
                  <p>Product price</p>
                  <p>${order.orderTotal - order.orderDelivery}</p>
                  <img alt="" src={'/icons/plus.svg'} style={{ marginLeft: '20px' }} />
                  <p>Delivery cost</p>
                  <p>${order.orderDelivery}</p>
                  <img
                    src={'/icons/pause.svg'}
                    alt=""
                    style={{ marginLeft: '20px' }}
                  />
                  <p>Total</p>
                  <p>${order.orderTotal}</p>
                </Box>
                <p className={'data-compl'}>
                  {moment(order.updatedAt).format('YYYY-MM-DD HH:mm')}
                </p>
                <Button
                  variant="contained"
                  className={'verify-button'}
                  value={order._id}
                  onClick={finishOrderHandler}
                >
                  Verify to Fulfil
                </Button>
              </Box>
            </Box>
          );
        })}

        {processOrders.length === 0 && (
          <Box
            display={'flex'}
            flexDirection={'row'}
            justifyContent={'center'}
          >
            <img
              src={'/icons/noimage-list.svg'}
              alt="No processing orders"
              style={{ width: 300, height: 300 }}
            />
          </Box>
        )}
      </Stack>
    </TabPanel>
  );
}
