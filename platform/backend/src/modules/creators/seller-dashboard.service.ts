import { Inject, Injectable } from '@nestjs/common';
import { type Database } from '@boikonika/database';
import { fromMinor, toMinor } from '@boikonika/shared';
import { sql } from 'drizzle-orm';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { PayoutsService } from '../commerce/payouts.service';
import { SellersService } from '../marketplace/sellers.service';
import { ReviewsService } from '../reviews/reviews.service';

type Row = Record<string, unknown>;

/** Sub-orders that count as sales: not cancelled, and paid unless cash on delivery. */
const COUNTED = sql`so.status not in ('cancelled') and (o.payment_method = 'cod' or o.payment_status in ('paid', 'partially_refunded', 'refunded'))`;

/** Seller home: sales over a period (vs the previous one), daily trend, work to do, stock alerts. */
@Injectable()
export class SellerDashboardService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sellers: SellersService,
    private readonly payouts: PayoutsService,
    private readonly reviews: ReviewsService,
    private readonly storage: StorageService,
  ) {}

  async overview(userId: string, days: number) {
    const seller = await this.sellers.requireSeller(userId);
    const sellerId = seller.id;
    const window = (offsetDays: number) => sql`so.created_at >= now() - make_interval(days => ${days + offsetDays}) and so.created_at < now() - make_interval(days => ${offsetDays})`;
    const kpis = (offset: number) =>
      this.db
        .execute<Row>(sql`
          with s as (
            select so.id, so.items_subtotal - so.discount_total + so.shipping_fee as total, so.seller_earning
            from seller_orders so join orders o on o.id = so.order_id
            where so.seller_id = ${sellerId} and ${COUNTED} and ${window(offset)}
          )
          select (select count(*) from s)::int as orders,
            coalesce((select sum(total) from s), 0)::text as revenue,
            coalesce((select sum(seller_earning) from s), 0)::text as earnings,
            coalesce((select sum(oi.quantity) from order_items oi where oi.seller_order_id in (select id from s)), 0)::int as units`)
        .then((r) => r.rows[0]!);

    const [current, previous, series, actions, lowStock, top, store, summary, recentReviews] = await Promise.all([
      kpis(0),
      kpis(days),
      this.db.execute<Row>(sql`
        with days as (select generate_series((now() at time zone 'Asia/Dhaka')::date - ${days - 1}::int, (now() at time zone 'Asia/Dhaka')::date, interval '1 day')::date as day)
        select d.day::text as day, coalesce(sum(so.items_subtotal - so.discount_total + so.shipping_fee), 0)::text as revenue, count(so.id)::int as orders
        from days d left join (seller_orders so join orders o on o.id = so.order_id)
          on (so.created_at at time zone 'Asia/Dhaka')::date = d.day and so.seller_id = ${sellerId} and ${COUNTED}
        group by d.day order by d.day`),
      this.db.execute<Row>(sql`
        select
          count(*) filter (where so.status = 'pending')::int as pending,
          count(*) filter (where so.status = 'confirmed')::int as confirmed,
          count(*) filter (where so.status = 'processing')::int as processing,
          (select count(*)::int from return_requests r join seller_orders s2 on s2.id = r.seller_order_id where s2.seller_id = ${sellerId} and r.status = 'requested') as returns
        from seller_orders so join orders o on o.id = so.order_id where so.seller_id = ${sellerId} and ${COUNTED}`),
      this.db.execute<Row>(sql`
        select p.id, p.title, v.name as variant, greatest(i.quantity_on_hand - i.quantity_reserved, 0)::int as available, i.low_stock_threshold
        from inventory i join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id
        where p.seller_id = ${sellerId} and p.status = 'active' and p.deleted_at is null and v.is_active and i.track_inventory
          and i.quantity_on_hand - i.quantity_reserved <= i.low_stock_threshold
        order by available asc, p.title limit 10`),
      this.db.execute<Row>(sql`
        select coalesce(oi.product_id::text, oi.title) as key, max(oi.product_id::text) as product_id, max(oi.title) as title, max(oi.image_key) as image_key,
          sum(oi.quantity)::int as units, sum(oi.line_total)::text as revenue
        from order_items oi join seller_orders so on so.id = oi.seller_order_id join orders o on o.id = so.order_id
        where so.seller_id = ${sellerId} and ${COUNTED} and ${window(0)}
        group by 1 order by sum(oi.quantity) desc, sum(oi.line_total) desc limit 5`),
      this.db.execute<Row>(sql`select name, slug, rating_avg::float as rating, rating_count, product_count from seller_stores where seller_id = ${sellerId}`),
      this.payouts.summary(userId),
      this.reviews.forSeller(sellerId, 5),
    ]);

    const change = (now: string | number, before: string | number) => {
      const a = typeof now === 'string' ? toMinor(now) : now;
      const b = typeof before === 'string' ? toMinor(before) : before;
      return b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10;
    };
    const orders = Number(current.orders);
    const storeRow = store.rows[0];
    return {
      days,
      store: storeRow ? { name: storeRow.name, slug: storeRow.slug, rating: Number(storeRow.rating ?? 0), ratingCount: Number(storeRow.rating_count ?? 0), productCount: Number(storeRow.product_count ?? 0) } : null,
      kpis: {
        revenue: { value: fromMinor(toMinor(String(current.revenue))), change: change(String(current.revenue), String(previous.revenue)) },
        orders: { value: orders, change: change(orders, Number(previous.orders)) },
        units: { value: Number(current.units), change: change(Number(current.units), Number(previous.units)) },
        earnings: { value: fromMinor(toMinor(String(current.earnings))), change: change(String(current.earnings), String(previous.earnings)) },
        averageOrder: { value: orders ? fromMinor(Math.round(toMinor(String(current.revenue)) / orders)) : '0.00', change: null },
      },
      series: series.rows.map((r) => ({ day: r.day as string, revenue: fromMinor(toMinor(r.revenue as string)), orders: Number(r.orders) })),
      actions: { pending: Number(actions.rows[0]?.pending ?? 0), confirmed: Number(actions.rows[0]?.confirmed ?? 0), processing: Number(actions.rows[0]?.processing ?? 0), returns: Number(actions.rows[0]?.returns ?? 0) },
      lowStock: lowStock.rows.map((r) => ({ productId: r.id, title: r.title, variant: r.variant, available: Number(r.available), threshold: Number(r.low_stock_threshold) })),
      topProducts: top.rows.map((r) => ({ productId: r.product_id, title: r.title, imageUrl: this.storage.publicUrl(r.image_key as string | null), units: Number(r.units), revenue: fromMinor(toMinor(r.revenue as string)) })),
      balance: { available: summary.available, pending: summary.pending, paid: summary.paid },
      reviews: recentReviews,
    };
  }
}
