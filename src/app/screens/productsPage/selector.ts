import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '../../../lib/types/screen';
import ProductsPage from '.';

const selectProductsage = (state: AppRootState) => state.productsPage;

export const retreiveRestaurant = createSelector(
  selectProductsage,
  (ProductsPage) => ProductsPage.restaurant
);

export const retreiveChosenProduct = createSelector(
  selectProductsage,
  (ProductsPage) => ProductsPage.choosenProduct
);

export const retreiveProducts = createSelector(
  selectProductsage,
  (ProductsPage) => ProductsPage.products
);
