CREATE INDEX "authors_name_alt_trgm_idx" ON "authors" USING gin ("name_alt" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_search_text_trgm_idx" ON "books" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_listing_idx" ON "books" USING btree ("status","offer_count","published_at");--> statement-breakpoint
CREATE INDEX "products_search_text_trgm_idx" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_book_offers_idx" ON "products" USING btree ("book_id","status","price") WHERE "products"."deleted_at" is null;