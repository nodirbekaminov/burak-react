`GET /product/:id` returns an active product with the existing response shape.
An authenticated account adds one lifetime view to each product. Reopening the
product, refreshing, retries, and concurrent requests from the same account
must not add more views. A different account adds its own first view.
Guests do not add account views. Existing view history and counters are preserved.

The backend records a key consisting of view group, member ID, and product ID
under a unique sparse index. Only the request that inserts a new view increments
the product counter. Historical view records without a key are still honored.

Product detail renders matching cached card data immediately and refreshes it
in the background. It never renders another product's cached image. Opening a
direct URL without cached data uses static placeholders, without a spinner.

Frontend validation from the React repository:

```sh
CI=true npm test -- --watchAll=false --runInBand src/app/screens/productsPage/ChosenProduct.test.tsx
```

Before its removal, the HTTP regression script verified first/repeat/concurrent
views, another account, another product, guests, and historical view records.
Its temporary products, accounts, views, and credentials were removed after the
check. Postman event reporting was disabled.
