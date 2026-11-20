import { createSelector } from '@reduxjs/toolkit';
import { AppRootState, HomePageState } from '../../../lib/types/screen';

const selectHomePage = (state: AppRootState) => state.homePage;

export const retrievePopularDishes = createSelector(
  (state: AppRootState) => state.homePage,
  (HomePage: HomePageState) => HomePage.popularDishes
);

export const retrieveNewDishes = createSelector(
  (state: AppRootState) => state.homePage,
  (HomePage: HomePageState) => HomePage.newDishes
);

export const retrieveTopUsers = createSelector(
  (state: AppRootState) => state.homePage,
  (HomePage: HomePageState) => HomePage.topUsers
);
