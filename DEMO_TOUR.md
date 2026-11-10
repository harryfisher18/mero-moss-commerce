# Demo tour

A guided path through Mero & Moss: shop, place an order, then run the business behind it. Allow about five minutes. Every step below is also run by an automated test, `tests/e2e/demo-tour.spec.ts`.

**Setup:** run `npm install` and `npm run dev`, then open <http://localhost:3000>. No API keys are needed.

Everything here is demo data. Orders are simulated, no payment is taken, and no messages are sent.

## 1. Shop and place an order

1. In the header, select **Workspace**.
2. Select **Brass Task Lamp**.
3. Select **Add to cart**.
4. In the header, select **Cart**, then **Continue to checkout**.
5. Fill in the form with any details. For **State**, choose **Oregon**.
6. Tick **I understand this is a simulated order**, then select **Place simulated order**.
7. Note the order number on the confirmation page.

## 2. Open the merchant console

1. Go to <http://localhost:3000/admin>.
2. Sign in with `merchant@meroandmoss.example` and `moss-demo-2026`.
3. You land on **Overview**: every figure there is counted from the store's data and links to where you can act on it.
4. In the console menu, select **Orders**. Your order is at the top. Select its order number.
5. The **Automation** panel shows the ship zone the order was routed to.

## 3. Watch the automation

1. In the console menu, select **Automations**, then select your order number in the list.
2. Review the routing, the notification previews marked **Preview only · not sent**, and the payload with personal data masked.
3. Select **Replay event**. The log shows the event was already applied, and nothing is created twice.
4. Select **All automation events** at the top of the page, then **Start dead-letter drill**.
5. Select **Retry now** four times. Each failure shows the next retry delay, and after the fifth attempt the event moves to the dead letter queue.

## 4. Ask the shopping advisor

1. In the console menu, select **View store**, then **Ask an advisor** in the header.
2. In **Your question**, type `Travel gifts under $50`, then select **Ask**.
3. Every card is in stock and within budget, and links to the exact variant at its current price.

## 5. Draft product copy

1. Go back to <http://localhost:3000/admin>, and select **Products** in the console menu.
2. Select **Oak Monitor Stand**, then **Content Studio**.
3. Select **Generate a new draft**. Without an API key, the draft is labelled **Rules-based draft**.
4. Review the factual checks and the changes marked against the live copy.
5. Select **Approve and publish**. This changes the demo catalog only, and the product's change history records it.

## 6. Compare before and after

1. In the console menu, select **Upgrade Lab**. Every comparison is illustrative, and none claims a measured result.
2. Select **Linen Storage Bin**. On the **Before** side, choose **Moss** and select **Add**. The failure only appears after pressing the button.
3. On the **After** side, select **Moss**. The page says **Sold out** before any attempt to buy.
4. Select **Product discovery**, then **Travel gifts under $50**, and compare the two results.
5. Select **Order operations** to compare a forwarded note with the automation rules for a real order.

## Also worth opening

These are all in the console menu.

- **Analytics:** a funnel built from recorded events, including your session.
- **Lifecycle:** journeys, previews and consent. Tick the optional email box at checkout to see one.
- **Requests:** questions sent through the advisor's **Talk to a person** form.
- **Integrations:** what the store is really connected to.

To start again from clean data, stop the server and run `npm run db:reset`.
