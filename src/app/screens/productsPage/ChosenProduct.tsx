import React, { useEffect, useRef, useState } from 'react';
import { Container, Stack, Box, Skeleton } from '@mui/material';
import { Swiper, SwiperSlide } from 'swiper/react';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import Divider from '../../components/divider';
import Button from '@mui/material/Button';
import Rating from '@mui/material/Rating';
import { useParams } from 'react-router-dom'; // @ts-ignore
import { FreeMode, Navigation, Thumbs } from 'swiper';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { setChosenProduct, setRestauarnt } from './slice';
import { Product } from '../../../lib/types/product';
import { retreiveChosenProduct, retreiveRestaurant } from './selector';
import ProductService from '../../services/ProductService';
import MemberService from '../../services/MemberService';
import { Member } from '../../../lib/types/member';
import { serverApi } from '../../../lib/config';
import { CartItem } from '../../../lib/types/search';
import { AppRootState } from '../../../lib/types/screen';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';

/** REDUX SLICE & SELECTOR **/
const restaurantRetreiver = createSelector(
  retreiveRestaurant,
  (restaurant) => ({
    restaurant,
  })
);

interface ChosenProductProps {
  onAdd: (item: CartItem) => void;
}

export default function ChosenProduct(props: ChosenProductProps) {
  const { onAdd } = props;
  const { productId } = useParams<{ productId: string }>();
  const dispatch = useDispatch();
  // The card already contains the product: render it immediately while the
  // server refreshes its details and records the user's unique view.
  const chosenProduct = useSelector((state: AppRootState) => {
    const detail = retreiveChosenProduct(state);
    if (detail?._id === productId) return detail;
    return [
      ...state.productsPage.products,
      ...state.homePage.popularDishes,
      ...state.homePage.newDishes,
    ].find((product) => product._id === productId) ?? null;
  });
  const { restaurant } = useSelector(restaurantRetreiver);
  const productRequest = useRef<{
    id: string;
    promise: Promise<Product>;
  } | null>(null);
  const restaurantRequest = useRef<Promise<Member> | null>(null);
  const [loadState, setLoadState] = useState<{
    id: string;
    status: 'loading' | 'ready' | 'error';
  }>({ id: productId, status: 'loading' });

  useEffect(() => {
    let active = true;
    setLoadState({ id: productId, status: 'loading' });

    // Reuse the request during StrictMode's effect replay. The backend owns
    // unique view counting; return visits can safely refresh the details.
    if (productRequest.current?.id !== productId) {
      productRequest.current = {
        id: productId,
        promise: new ProductService().getProduct(productId),
      };
    }
    productRequest.current.promise
      .then((data) => {
        if (!active) return;
        dispatch(setChosenProduct(data));
        setLoadState({ id: productId, status: 'ready' });
      })
      .catch((err) => {
        if (!active) return;
        console.log(err);
        setLoadState({ id: productId, status: 'error' });
      });

    if (!restaurantRequest.current) {
      restaurantRequest.current = new MemberService().getRestaurant();
    }
    restaurantRequest.current
      .then((data) => {
        if (active) dispatch(setRestauarnt(data));
      })
      .catch((err) => console.log(err));

    // A slow response for a previous route must not replace the current item.
    return () => {
      active = false;
    };
  }, [productId, dispatch]);

  if (!chosenProduct && loadState.id === productId && loadState.status === 'error') {
    return (
      <Box className="chosen-product" role="alert" sx={{ textAlign: 'center' }}>
        Unable to load this product. Please try again.
      </Box>
    );
  }

  if (!chosenProduct) {
    return (
      <div className="chosen-product" aria-label="Loading product" aria-busy="true">
        <Box className="title">Product Detail</Box>
        <Container className="product-container">
          <Stack className="chosen-product-slider">
            <Skeleton variant="rectangular" animation={false} width="100%" height={360} />
          </Stack>
          <Stack className="chosen-product-info">
            <Skeleton animation={false} width="70%" height={60} />
            <Skeleton animation={false} width="90%" height={32} />
            <Skeleton animation={false} width="50%" height={32} />
          </Stack>
        </Container>
      </div>
    );
  }
  return (
    <div className={'chosen-product'}>
      <Box className={'title'}>Product Detail</Box>
      <Container className={'product-container'}>
        <Stack className={'chosen-product-slider'}>
          <Swiper
            key={chosenProduct._id}
            loop={true}
            spaceBetween={10}
            navigation={true}
            modules={[FreeMode, Navigation, Thumbs]}
            className="swiper-area"
          >
            {chosenProduct.productImages.map((ele: string) => {
              const imagePath = `${serverApi}/${ele}`;
              return (
                <SwiperSlide key={ele}>
                  <img
                    className="slider-image"
                    src={imagePath}
                    alt={chosenProduct.productName}
                  />
                </SwiperSlide>
              );
            })}
          </Swiper>
        </Stack>
        <Stack className={'chosen-product-info'}>
          <Box className={'info-box'}>
            <strong className={'product-name'}>
              {chosenProduct?.productName}
            </strong>
            <span className={'resto-name'}>{restaurant?.memberNick}</span>
            <span className={'resto-name'}>{restaurant?.memberPhone}</span>
            <Box className={'rating-box'}>
              <Rating name="half-rating" defaultValue={2.5} precision={0.5} />
              <div className={'evaluation-box'}>
                <div className={'product-view'}>
                  <RemoveRedEyeIcon sx={{ mr: '10px' }} />
                  <span>{chosenProduct?.productViews}</span>
                </div>
              </div>
            </Box>
            <p className={'product-desc'}>
              {chosenProduct?.productDesc
                ? chosenProduct?.productDesc
                : 'No Description'}
            </p>
            <Divider height="1" width="100%" bg="#000000" />
            <div className={'product-price'}>
              <span>Price:</span>
              <span>${chosenProduct?.productPrice}</span>
            </div>
            <div className={'button-box'}>
              <Button
                variant="contained"
                onClick={(e) => {
                  onAdd({
                    _id: chosenProduct._id,
                    quantity: 1,
                    name: chosenProduct.productName,
                    price: chosenProduct.productPrice,
                    image: chosenProduct.productImages[0],
                  });
                  e.stopPropagation();
                }}
              >
                Add To Basket
              </Button>
            </div>
          </Box>
        </Stack>
      </Container>
    </div>
  );
}
