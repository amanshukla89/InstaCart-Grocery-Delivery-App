# InstaCart

A full stack grocery delivery app with three sides: customers shop and pay through Stripe, admins manage products and orders, and delivery partners work through their assigned deliveries.

**Live demo:** https://insta-cart-grocery-delivery-app-ua7.vercel.app/

The frontend is deployed on Vercel. The backend is deployed separately, and the production frontend reaches it through the configured API base URL.

## Features

**Customers**
- Register, log in, and use protected routes
- Browse products, filter by category, organic products, and minimum and maximum price, and sort by newest, price (low to high or high to low), top rated, or A to Z
- View product details, keep a cart, manage addresses, and check out
- Pay with Stripe Checkout, then track order history, order status, and delivery information

**Admins**
- Dashboard for creating, updating, and managing products
- Order management and status monitoring
- Delivery-partner management, including assigning partners to orders

**Delivery partners**
- Separate login and dashboard
- View assigned orders and update their delivery status

**Payments and orders**
- Stripe Checkout with webhook handling and payment verification
- Paid orders are marked as paid and stock is updated after a successful payment
- Order events are sent through Inngest

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Hot Toast, Lucide React
- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL, bcrypt
- **Services:** Stripe, Inngest
- **Deployment:** Vercel, with a hosted PostgreSQL database

## How it fits together

The React frontend talks to the Express backend over a REST API. The backend reads and writes PostgreSQL through Prisma, creates Stripe Checkout sessions, and receives Stripe's webhook when a payment completes. Order and inventory events go through Inngest.

```
client-side/   React + Vite frontend
server/        Express API, controllers, routes, and the Prisma schema (prisma/schema.prisma)
```

## Database

PostgreSQL with Prisma. The main models are `User`, `Address`, `Product`, `Order`, and `DeliveryPartner`.

A product stores its name, description, price, original price, image, category, unit, stock, organic flag, rating, and review count.

## How an order moves through the system

1. The customer browses products, adds them to the cart, picks an address and a payment method, and checks out.
2. For card payments, the customer is sent to Stripe Checkout.
3. After a successful payment, Stripe calls the webhook.
4. The backend verifies the payment, finds the order, marks it paid, and updates stock.
5. Order and inventory events are triggered through Inngest.
6. The order appears in My Orders. An admin assigns a delivery partner, who updates the status until the order is delivered.

The webhook route reads the raw request body so Stripe's signature can be verified, which is why it is registered before `express.json()`.

## Environment variables

Create a `.env` file in each app.

**client-side/.env**

```
VITE_BASE_URL=http://localhost:5000/api
VITE_CURRENCY_SYMBOL=$
```

In production, set `VITE_BASE_URL` to your deployed backend, for example `https://your-backend-domain.vercel.app/api`. Never leave it as localhost in a deployed frontend: from a visitor's browser, localhost is their own machine.

**server/.env**

```
DATABASE_URL=your_postgresql_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Never commit `.env` files or real keys, and use Stripe test-mode keys while developing.

## Running locally

Create the two `.env` files first, then clone the repo:

```bash
git clone https://github.com/amanshukla89/InstaCart-Grocery-Delivery-App.git
cd InstaCart-Grocery-Delivery-App
```

Start the backend:

```bash
cd server
npm install
npx prisma generate
npm run dev
```

In a second terminal, start the frontend:

```bash
cd client-side
npm install
npm run dev
```

Vite prints the local URL for the frontend in the terminal. To check a production build of the frontend, run `npm run build` inside `client-side`.

## Product filters

Filters and sorting live in the URL query string, and the frontend refetches products whenever they change:

```
/products?category=fruits
/products?minPrice=10&maxPrice=100
/products?organic=true
/products?sort=price-low
/products?sort=price-high
```

The parameter names have to match what the backend controller reads, including the sort values `price-low` and `price-high`.

## Deployment

1. Push the project to GitHub.
2. Import the frontend into Vercel and set its environment variables.
3. Deploy the backend and connect the production database.
4. Add the Stripe keys for the environment you are deploying to, and point the Stripe webhook at the deployed backend.
5. Set `VITE_BASE_URL` to the deployed backend API.
6. Run a full checkout and confirm the order shows up as paid.

Before going live, also check that the database is reachable and that Prisma Client has been generated.

## What went wrong in production

- **Localhost API URL.** My deployed frontend was still calling `http://localhost:5000/api`, so its requests never reached the backend. Setting `VITE_BASE_URL` to the deployed backend fixed it.
- **Stripe webhook body.** Signature verification needs the raw request body, so the webhook route has to be registered before `express.json()`.
- **Paid orders.** Card orders are filtered by `isPaid`, so the webhook has to mark the right order as paid or successful payments won't show up in order history.
- **Filter parameter names.** The frontend and backend must use identical names for filters and sort values, such as `price-low` and `price-high`.

## Security notes

- Never expose Stripe secret keys in the frontend.
- Keep the Stripe webhook secret private.
- Store passwords hashed with bcrypt, never in plain text.
- Validate authentication on protected backend routes.

## Ideas for later

- Better product search
- Reviews and ratings
- Coupons and discounts
- Real-time delivery tracking
- Admin analytics
- Automated tests and a CI pipeline

## Author

Aman Shukla, full stack developer

- LinkedIn: https://www.linkedin.com/in/amanshukla-775188361
- GitHub: https://github.com/amanshukla89