# Mobile payment integration contract

The application currently has no active mobile-money provider. The mobile payment routes intentionally return HTTP 503 with `MOBILE_PAYMENT_PROVIDER_NOT_CONFIGURED`; they do not create a payment attempt or mark an invoice paid.

## Endpoints

- `GET /api/mobile-payments/invoices` lists the authenticated company's invoices.
- `POST /api/mobile-payments/intents` accepts `{ "invoiceId", "provider", "phoneNumber" }` and requires an `Idempotency-Key` header. It only accepts an unpaid invoice belonging to the authenticated company.
- `GET /api/mobile-payments/intents/:id` returns an attempt belonging to the authenticated company.
- `POST /api/mobile-payments/webhooks/:provider` is reserved for provider callbacks and currently returns 503 without processing the request.

## Provider activation requirements

Implement each provider behind a server-side adapter. Store credentials only in server environment variables. Verify the provider's documented signature and timestamp before parsing a webhook as authoritative; enforce event idempotency with `(provider_key, event_id)`. Match the invoice, amount, and XAF currency against the provider transaction before settling an attempt. Never trust a browser redirect or client-supplied payment status. Only a verified provider event may settle an invoice automatically.

Manual settlement remains available independently of mobile payment integration. It records the payment method and optional receipt or transaction reference; subscription access remains a separate administrative decision.
