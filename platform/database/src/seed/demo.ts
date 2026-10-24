import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { ARGON2_OPTIONS, type Role } from '@boikonika/shared';
import { eq, inArray } from 'drizzle-orm';
import { refreshAuthorBookCounts, refreshBookOffers, refreshProductStock, refreshStoreProductCounts } from '../aggregates';
import type { Database, Transaction } from '../client';
import {
  authors,
  bookAuthors,
  bookCategories,
  bookFormats,
  bookGenres,
  bookPublishers,
  books,
  categories,
  genres,
  inventory,
  inventoryMovements,
  productCategories,
  products,
  productVariants,
  publisherAuthors,
  publishers,
  sellers,
  sellerStores,
  userProfiles,
  userRoles,
  users,
} from '../schema';
import { buildSearchText } from '../search';
import { DEMO_AUTHORS, DEMO_BOOKS, DEMO_PRODUCTS } from './data/demo-catalog';

const DEMO_PUBLISHER = { slug: 'demo-classics', name: 'ডেমো ক্লাসিকস', nameAlt: 'Demo Classics', description: 'চিরায়ত সাহিত্যের ডেমো প্রকাশনী (শুধু উন্নয়ন ও পরীক্ষার জন্য)।' };

const DEMO_ACCOUNTS: Array<{ key: string; username: string; email: string; displayName: string; roles: Role[] }> = [
  { key: 'reader', username: 'demo_reader', email: 'demo.reader@example.com', displayName: 'ডেমো পাঠক', roles: ['customer', 'student'] },
  { key: 'boighor', username: 'demo_boighor', email: 'demo.boighor@example.com', displayName: 'ডেমো বইঘর', roles: ['customer', 'book_seller'] },
  { key: 'used', username: 'demo_purono_boi', email: 'demo.usedbooks@example.com', displayName: 'ডেমো পুরোনো বই', roles: ['customer', 'book_seller'] },
  { key: 'stationery', username: 'demo_stationery', email: 'demo.stationery@example.com', displayName: 'ডেমো স্টেশনারি', roles: ['customer', 'general_seller'] },
];

const DEMO_STORES = {
  boighor: { slug: 'demo-boighor', name: 'ডেমো বইঘর', tagline: 'চিরায়ত বাংলা সাহিত্যের নতুন কপি', type: 'book_seller' as const, division: 'dhaka', district: 'dhaka', featured: true },
  used: { slug: 'demo-purono-boi', name: 'ডেমো পুরোনো বই', tagline: 'যত্নে রাখা পুরোনো বই, কম দামে', type: 'book_seller' as const, division: 'chattogram', district: 'chattogram', featured: false },
  stationery: { slug: 'demo-stationery', name: 'ডেমো স্টেশনারি', tagline: 'পড়ার টেবিলের সব দরকারি জিনিস', type: 'general_seller' as const, division: 'rajshahi', district: 'rajshahi', featured: true },
};

/** Fictional demo data for development/staging. Refuses to run in production. All-or-nothing. */
export async function seedDemo(db: Database, log: (message: string) => void): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }
  const [already] = await db.select({ id: sellerStores.id }).from(sellerStores).where(eq(sellerStores.slug, DEMO_STORES.boighor.slug));
  if (already) {
    log('demo: already seeded (store "demo-boighor" exists) — skipped');
    return;
  }

  const generated = !process.env.SEED_DEMO_PASSWORD;
  const password = process.env.SEED_DEMO_PASSWORD ?? `Demo-${randomBytes(6).toString('base64url')}7`;
  const passwordHash = await hash(password, ARGON2_OPTIONS);

  await db.transaction(async (tx) => {
    const now = new Date();
    const userIds: Record<string, string> = {};
    for (const account of DEMO_ACCOUNTS) {
      const [user] = await tx
        .insert(users)
        .values({ username: account.username, email: account.email, displayName: account.displayName, passwordHash, emailVerifiedAt: now, onboardedAt: now })
        .returning({ id: users.id });
      userIds[account.key] = user!.id;
      await tx.insert(userProfiles).values({ userId: user!.id, favoriteGenres: account.key === 'reader' ? ['bangla_literature', 'poetry', 'science_fiction'] : [] });
      await tx.insert(userRoles).values(account.roles.map((role) => ({ userId: user!.id, role })));
    }

    const sellerIds: Record<keyof typeof DEMO_STORES, string> = {} as Record<keyof typeof DEMO_STORES, string>;
    for (const [key, store] of Object.entries(DEMO_STORES) as Array<[keyof typeof DEMO_STORES, (typeof DEMO_STORES)[keyof typeof DEMO_STORES]]>) {
      const [seller] = await tx.insert(sellers).values({ userId: userIds[key]!, type: store.type, status: 'active', approvedAt: now }).returning({ id: sellers.id });
      sellerIds[key] = seller!.id;
      await tx.insert(sellerStores).values({
        sellerId: seller!.id,
        slug: store.slug,
        name: store.name,
        tagline: store.tagline,
        description: `${store.name} — বইকণিকার ডেমো স্টোর। এখানকার অর্ডার শুধু পরীক্ষার জন্য।`,
        division: store.division,
        district: store.district,
        isFeatured: store.featured,
        returnPolicy: 'ডেলিভারির ৭ দিনের মধ্যে ত্রুটিপূর্ণ বা ভুল পণ্য ফেরত নেওয়া হয়।',
        shippingPolicy: 'অর্ডার নিশ্চিত হওয়ার ১ কর্মদিবসের মধ্যে পাঠানো হয়।',
      });
    }

    const categoryRows = await tx.select({ id: categories.id, path: categories.path }).from(categories);
    const categoryId = (path: string) => {
      const found = categoryRows.find((c) => c.path === path);
      if (!found) throw new Error(`Unknown category path ${path} — run the reference seed first`);
      return found.id;
    };
    const genreRows = await tx.select({ id: genres.id, key: genres.key }).from(genres);
    const genreId = (key: string) => {
      const found = genreRows.find((g) => g.key === key);
      if (!found) throw new Error(`Unknown genre ${key}`);
      return found.id;
    };

    const [publisher] = await tx.insert(publishers).values({ ...DEMO_PUBLISHER, isVerified: true }).returning({ id: publishers.id });
    const authorIds: Record<string, string> = {};
    for (const author of DEMO_AUTHORS) {
      const [row] = await tx.insert(authors).values({ ...author, isVerified: true }).returning({ id: authors.id });
      authorIds[author.slug] = row!.id;
      await tx.insert(publisherAuthors).values({ publisherId: publisher!.id, authorId: row!.id });
    }

    const bookIds: string[] = [];
    const productIds: string[] = [];
    let sku = 0;
    const nextSku = (prefix: string) => `DEMO-${prefix}-${String(++sku).padStart(4, '0')}`;

    for (const [index, book] of DEMO_BOOKS.entries()) {
      const author = DEMO_AUTHORS.find((a) => a.slug === book.author)!;
      const searchText = buildSearchText([author.name, author.nameAlt, DEMO_PUBLISHER.name, DEMO_PUBLISHER.nameAlt]);
      const [bookRow] = await tx
        .insert(books)
        .values({
          slug: book.slug,
          title: book.title,
          description: book.description,
          language: book.language,
          primaryCategoryId: categoryId(book.category),
          ageGroup: book.ageGroup ?? null,
          firstPublishedYear: book.year ?? null,
          searchText,
          editorsPick: book.editorsPick ?? false,
          studentPick: book.studentPick ?? false,
          teacherPick: book.teacherPick ?? false,
          // Stagger "published" dates so the New releases shelf has a stable order.
          publishedAt: new Date(now.getTime() - index * 36 * 3600 * 1000),
        })
        .returning({ id: books.id });
      const bookId = bookRow!.id;
      bookIds.push(bookId);
      await tx.insert(bookAuthors).values({ bookId, authorId: authorIds[book.author]!, role: 'author' });
      await tx.insert(bookPublishers).values({ bookId, publisherId: publisher!.id });
      await tx.insert(bookCategories).values([book.category, ...(book.extraCategories ?? [])].map((path) => ({ bookId, categoryId: categoryId(path) })));
      await tx.insert(bookGenres).values(book.genres.map((key) => ({ bookId, genreId: genreId(key) })));
      const [format] = await tx
        .insert(bookFormats)
        .values({ bookId, format: book.format ?? 'paperback', publisherId: publisher!.id, publicationYear: 2025, pages: book.pages, weightGrams: book.weightGrams, edition: 'ডেমো সংস্করণ' })
        .returning({ id: bookFormats.id });

      const offers = [
        { seller: 'boighor' as const, condition: 'new' as const, price: book.price, compareAtPrice: book.compareAtPrice ?? null, stock: book.stock, note: null as string | null },
        ...(book.used ?? []).map((u) => ({ seller: 'used' as const, condition: u.condition, price: u.price, compareAtPrice: null, stock: 1, note: u.note })),
      ];
      for (const offer of offers) {
        const productId = await createProduct(tx, {
          sellerId: sellerIds[offer.seller],
          type: 'book',
          bookId,
          bookFormatId: format!.id,
          condition: offer.condition,
          conditionNote: offer.note,
          title: book.title,
          slug: `${book.slug}-${DEMO_STORES[offer.seller].slug}${offer.condition === 'new' ? '' : `-${offer.condition.replace(/_/g, '-')}`}`,
          description: book.description,
          categoryId: categoryId(book.category),
          weightGrams: book.weightGrams,
          searchText: buildSearchText([book.title, author.name, author.nameAlt, DEMO_PUBLISHER.name]),
          extraCategories: (book.extraCategories ?? []).map(categoryId),
          variants: [{ sku: nextSku(offer.seller === 'boighor' ? 'BG' : 'PB'), name: 'Default', options: {}, price: offer.price, compareAtPrice: offer.compareAtPrice, stock: offer.stock }],
        });
        productIds.push(productId);
      }
    }

    for (const product of DEMO_PRODUCTS) {
      const productId = await createProduct(tx, {
        sellerId: sellerIds.stationery,
        type: 'general',
        bookId: null,
        bookFormatId: null,
        condition: 'new',
        conditionNote: null,
        title: product.title,
        slug: product.slug,
        description: product.description,
        categoryId: categoryId(product.category),
        weightGrams: product.weightGrams,
        searchText: buildSearchText([product.title, ...product.variants.map((v) => v.name)]),
        extraCategories: [],
        variants: product.variants.map((v) => ({ sku: nextSku('ST'), name: v.name, options: v.options, price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock })),
      });
      productIds.push(productId);
    }

    await refreshProductStock(tx, productIds);
    await refreshBookOffers(tx, bookIds);
    await refreshAuthorBookCounts(tx, Object.values(authorIds));
    await refreshStoreProductCounts(tx, Object.values(sellerIds));
    log(`demo: ${DEMO_ACCOUNTS.length} accounts, ${Object.keys(DEMO_STORES).length} stores, ${DEMO_AUTHORS.length} authors, ${bookIds.length} books, ${productIds.length} listings`);
  });

  const emails = DEMO_ACCOUNTS.map((a) => a.email).join(', ');
  log(generated ? `demo: accounts ${emails} — password (shown once): ${password}` : `demo: accounts ${emails} — password from SEED_DEMO_PASSWORD`);
}

interface NewProduct {
  sellerId: string;
  type: 'book' | 'general';
  bookId: string | null;
  bookFormatId: string | null;
  condition: 'new' | 'used_like_new' | 'used_good' | 'used_acceptable';
  conditionNote: string | null;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  extraCategories: string[];
  weightGrams: number;
  searchText: string;
  variants: Array<{ sku: string; name: string; options: Record<string, string>; price: string; compareAtPrice: string | null; stock: number }>;
}

async function createProduct(tx: Transaction, p: NewProduct): Promise<string> {
  const cheapest = [...p.variants].sort((a, b) => Number(a.price) - Number(b.price))[0]!;
  const [product] = await tx
    .insert(products)
    .values({
      sellerId: p.sellerId,
      type: p.type,
      bookId: p.bookId,
      bookFormatId: p.bookFormatId,
      condition: p.condition,
      conditionNote: p.conditionNote,
      title: p.title,
      slug: p.slug,
      description: p.description,
      categoryId: p.categoryId,
      status: 'active',
      price: cheapest.price,
      compareAtPrice: cheapest.compareAtPrice,
      weightGrams: p.weightGrams,
      searchText: p.searchText,
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  const productId = product!.id;
  if (p.extraCategories.length) await tx.insert(productCategories).values(p.extraCategories.map((categoryId) => ({ productId, categoryId })));
  const variantRows = await tx
    .insert(productVariants)
    .values(p.variants.map((v, position) => ({ productId, sku: v.sku, name: v.name, options: v.options, price: v.price, compareAtPrice: v.compareAtPrice, isDefault: position === 0, position, weightGrams: p.weightGrams })))
    .returning({ id: productVariants.id, sku: productVariants.sku });
  const stockBySku = new Map(p.variants.map((v) => [v.sku, v.stock]));
  await tx.insert(inventory).values(variantRows.map((v) => ({ variantId: v.id, quantityOnHand: stockBySku.get(v.sku) ?? 0 })));
  const movements = variantRows.filter((v) => (stockBySku.get(v.sku) ?? 0) > 0).map((v) => ({ variantId: v.id, reason: 'initial' as const, onHandDelta: stockBySku.get(v.sku)!, note: 'Demo opening stock' }));
  if (movements.length) await tx.insert(inventoryMovements).values(movements);
  return productId;
}

export async function demoAccountIds(db: Database): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.username, DEMO_ACCOUNTS.map((a) => a.username)));
  return rows.map((r) => r.id);
}
