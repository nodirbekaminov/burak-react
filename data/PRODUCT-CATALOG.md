The catalog fills each Burak category to 16 active products while preserving
existing products. It adds 75 products to the original 5-product database.
Prices are sample menu prices in the app's existing dollar currency, and new
products start with stock 40 and zero views.

Five photos reuse the project's existing `public/img` assets. Seventy photos
are downloaded from TheMealDB and TheCocktailDB; their original item names and
source pages are recorded in `product-catalog.json` for attribution.
All customer-facing product images are local files, copied into the backend's
`uploads/products/catalog` directory. No external image URLs are stored in products.

The completed import is recorded in `product-import-report.json`. The helper
scripts have been removed; the imported database records and local photos remain.
No database credentials are stored here.
