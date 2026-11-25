import { useState } from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import ChosenProduct from './ChosenProduct';
import Products from './Products';
import '../../../css/products.css';
import { CartItem } from '../../../lib/types/search';
import { ProductInquiry } from '../../../lib/types/product';
import { ProductCollection } from '../../../lib/enums/product.enum';

interface ProductsPageProps {
  onAdd: (item: CartItem) => void;
}

export default function ProductsPage(props: ProductsPageProps) {
  const { onAdd } = props;
  const products = useRouteMatch();
  // Keep catalog filters mounted while the detail route is open.
  const [productSearch, setProductSearch] = useState<ProductInquiry>({
    page: 1,
    limit: 8,
    order: 'createdAt',
    productCollection: ProductCollection.DISH,
    search: '',
  });
  console.log('products:', products);

  return (
    <div className={'products-page'}>
      <Switch>
        <Route path={`${products.path}/:productId`}>
          <ChosenProduct onAdd={onAdd} />
        </Route>
        <Route path={`${products.path}`}>
          <Products
            onAdd={onAdd}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
          />
        </Route>
      </Switch>
    </div>
  );
}
