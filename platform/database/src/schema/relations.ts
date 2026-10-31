import { relations } from 'drizzle-orm';
import { authors, bookAuthors, bookCategories, bookFormats, bookGenres, bookImages, bookPreviews, bookPublishers, bookTags, books, categories, digitalAssets, genres, publishers, tags } from './catalog';
import { bookClubMembers, bookClubPosts, bookClubs } from './clubs';
import { addresses, cartItems, carts, wishlistItems, wishlists } from './commerce';
import { comments, postMedia, posts, reviews } from './community';
import { oauthAccounts, sessions, userProfiles, userRoles, users } from './identity';
import { kycDocuments, kycEvents, kycVerifications } from './kyc';
import { inventory, productImages, productVariants, products, sellerStores, sellers } from './marketplace';
import { orderItems, orderStatusHistory, orders, sellerOrders } from './orders';
import { payments, paymentTransactions, payoutItems, payouts, refunds } from './payments';
import { quizQuestions, quizzes } from './student';
import { shipmentTracking, shipments } from './shipping';

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  roles: many(userRoles),
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
  addresses: many(addresses),
}));
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({ user: one(users, { fields: [userProfiles.userId], references: [users.id] }) }));
export const userRolesRelations = relations(userRoles, ({ one }) => ({ user: one(users, { fields: [userRoles.userId], references: [users.id] }) }));
export const sessionsRelations = relations(sessions, ({ one }) => ({ user: one(users, { fields: [sessions.userId], references: [users.id] }) }));
export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({ user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }) }));
export const addressesRelations = relations(addresses, ({ one }) => ({ user: one(users, { fields: [addresses.userId], references: [users.id] }) }));

export const kycVerificationsRelations = relations(kycVerifications, ({ one, many }) => ({
  user: one(users, { fields: [kycVerifications.userId], references: [users.id] }),
  documents: many(kycDocuments),
  events: many(kycEvents),
}));
export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({ verification: one(kycVerifications, { fields: [kycDocuments.verificationId], references: [kycVerifications.id] }) }));
export const kycEventsRelations = relations(kycEvents, ({ one }) => ({ verification: one(kycVerifications, { fields: [kycEvents.verificationId], references: [kycVerifications.id] }) }));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: 'category_parent' }),
  children: many(categories, { relationName: 'category_parent' }),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  primaryCategory: one(categories, { fields: [books.primaryCategoryId], references: [categories.id] }),
  formats: many(bookFormats),
  authors: many(bookAuthors),
  publishers: many(bookPublishers),
  categories: many(bookCategories),
  genres: many(bookGenres),
  tags: many(bookTags),
  images: many(bookImages),
  previews: many(bookPreviews),
  products: many(products),
}));
export const bookFormatsRelations = relations(bookFormats, ({ one, many }) => ({
  book: one(books, { fields: [bookFormats.bookId], references: [books.id] }),
  publisher: one(publishers, { fields: [bookFormats.publisherId], references: [publishers.id] }),
  digitalAssets: many(digitalAssets),
}));
export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
  book: one(books, { fields: [bookAuthors.bookId], references: [books.id] }),
  author: one(authors, { fields: [bookAuthors.authorId], references: [authors.id] }),
}));
export const bookPublishersRelations = relations(bookPublishers, ({ one }) => ({
  book: one(books, { fields: [bookPublishers.bookId], references: [books.id] }),
  publisher: one(publishers, { fields: [bookPublishers.publisherId], references: [publishers.id] }),
}));
export const bookCategoriesRelations = relations(bookCategories, ({ one }) => ({
  book: one(books, { fields: [bookCategories.bookId], references: [books.id] }),
  category: one(categories, { fields: [bookCategories.categoryId], references: [categories.id] }),
}));
export const bookGenresRelations = relations(bookGenres, ({ one }) => ({
  book: one(books, { fields: [bookGenres.bookId], references: [books.id] }),
  genre: one(genres, { fields: [bookGenres.genreId], references: [genres.id] }),
}));
export const bookTagsRelations = relations(bookTags, ({ one }) => ({
  book: one(books, { fields: [bookTags.bookId], references: [books.id] }),
  tag: one(tags, { fields: [bookTags.tagId], references: [tags.id] }),
}));
export const bookImagesRelations = relations(bookImages, ({ one }) => ({ book: one(books, { fields: [bookImages.bookId], references: [books.id] }) }));
export const bookPreviewsRelations = relations(bookPreviews, ({ one }) => ({ book: one(books, { fields: [bookPreviews.bookId], references: [books.id] }) }));
export const digitalAssetsRelations = relations(digitalAssets, ({ one }) => ({ format: one(bookFormats, { fields: [digitalAssets.bookFormatId], references: [bookFormats.id] }) }));
export const authorsRelations = relations(authors, ({ many }) => ({ books: many(bookAuthors) }));
export const publishersRelations = relations(publishers, ({ many }) => ({ books: many(bookPublishers), formats: many(bookFormats) }));

export const sellersRelations = relations(sellers, ({ one, many }) => ({
  user: one(users, { fields: [sellers.userId], references: [users.id] }),
  store: one(sellerStores, { fields: [sellers.id], references: [sellerStores.sellerId] }),
  products: many(products),
}));
export const sellerStoresRelations = relations(sellerStores, ({ one }) => ({ seller: one(sellers, { fields: [sellerStores.sellerId], references: [sellers.id] }) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
  book: one(books, { fields: [products.bookId], references: [books.id] }),
  bookFormat: one(bookFormats, { fields: [products.bookFormatId], references: [bookFormats.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventory: one(inventory, { fields: [productVariants.id], references: [inventory.variantId] }),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({ product: one(products, { fields: [productImages.productId], references: [products.id] }) }));
export const inventoryRelations = relations(inventory, ({ one }) => ({ variant: one(productVariants, { fields: [inventory.variantId], references: [productVariants.id] }) }));

export const cartsRelations = relations(carts, ({ many }) => ({ items: many(cartItems) }));
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));
export const wishlistsRelations = relations(wishlists, ({ many }) => ({ items: many(wishlistItems) }));
export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  wishlist: one(wishlists, { fields: [wishlistItems.wishlistId], references: [wishlists.id] }),
  book: one(books, { fields: [wishlistItems.bookId], references: [books.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  sellerOrders: many(sellerOrders),
  items: many(orderItems),
  payments: many(payments),
  history: many(orderStatusHistory),
}));
export const sellerOrdersRelations = relations(sellerOrders, ({ one, many }) => ({
  order: one(orders, { fields: [sellerOrders.orderId], references: [orders.id] }),
  seller: one(sellers, { fields: [sellerOrders.sellerId], references: [sellers.id] }),
  items: many(orderItems),
  shipments: many(shipments),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  sellerOrder: one(sellerOrders, { fields: [orderItems.sellerOrderId], references: [sellerOrders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({ order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }) }));
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  transactions: many(paymentTransactions),
}));
export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({ payment: one(payments, { fields: [paymentTransactions.paymentId], references: [payments.id] }) }));
export const refundsRelations = relations(refunds, ({ one }) => ({ order: one(orders, { fields: [refunds.orderId], references: [orders.id] }) }));
export const payoutsRelations = relations(payouts, ({ one, many }) => ({ seller: one(sellers, { fields: [payouts.sellerId], references: [sellers.id] }), items: many(payoutItems) }));
export const payoutItemsRelations = relations(payoutItems, ({ one }) => ({ payout: one(payouts, { fields: [payoutItems.payoutId], references: [payouts.id] }) }));
export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  sellerOrder: one(sellerOrders, { fields: [shipments.sellerOrderId], references: [sellerOrders.id] }),
  tracking: many(shipmentTracking),
}));
export const shipmentTrackingRelations = relations(shipmentTracking, ({ one }) => ({ shipment: one(shipments, { fields: [shipmentTracking.shipmentId], references: [shipments.id] }) }));

export const reviewsRelations = relations(reviews, ({ one }) => ({ user: one(users, { fields: [reviews.userId], references: [users.id] }) }));
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  book: one(books, { fields: [posts.bookId], references: [books.id] }),
  media: many(postMedia),
  comments: many(comments),
}));
export const postMediaRelations = relations(postMedia, ({ one }) => ({ post: one(posts, { fields: [postMedia.postId], references: [posts.id] }) }));
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
export const bookClubsRelations = relations(bookClubs, ({ many, one }) => ({
  owner: one(users, { fields: [bookClubs.ownerId], references: [users.id] }),
  members: many(bookClubMembers),
  posts: many(bookClubPosts),
}));
export const bookClubMembersRelations = relations(bookClubMembers, ({ one }) => ({
  club: one(bookClubs, { fields: [bookClubMembers.clubId], references: [bookClubs.id] }),
  user: one(users, { fields: [bookClubMembers.userId], references: [users.id] }),
}));
export const bookClubPostsRelations = relations(bookClubPosts, ({ one }) => ({ club: one(bookClubs, { fields: [bookClubPosts.clubId], references: [bookClubs.id] }) }));
export const quizzesRelations = relations(quizzes, ({ many }) => ({ questions: many(quizQuestions) }));
export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({ quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }) }));
