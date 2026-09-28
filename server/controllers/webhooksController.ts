import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from "../config/prisma.js";
import { Inngest } from "inngest";

const inngest = new Inngest({
    id: "instacart",
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const stripeWebhook = async (request: Request, response: Response) => {
    let event;
    if (endpointSecret) {
        // Get the signature sent by Stripe
        const signature = request.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(
                request.body,
                signature as string,
                endpointSecret
            );
        } catch (error: any) {
            console.log(`⚠️ Webhook signature verification failed.`, error.message);
            return response.sendStatus(400);
        }
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const paymentIntentId = paymentIntent.id;

            console.log("========== STRIPE WEBHOOK ==========");
            console.log("Payment Intent:", paymentIntentId);

            const session = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId
            });

            console.log("Sessions:", session.data);

            if (!session.data.length) {
                console.log("❌ No checkout session found");
                return response.status(400).json({
                    message: "Checkout session not found"
                });
            }

            const orderId = session.data[0].metadata?.orderId;

            console.log("Order ID:", orderId);

            if (!orderId) {
                console.log("❌ No orderId in metadata");
                return response.status(400).json({
                    message: "Order ID missing"
                });
            }

            const paidOrder = await prisma.order.update({
                where: { id: orderId },
                data: { isPaid: true }
            });

            console.log("✅ ORDER MARKED PAID:", paidOrder.id);

        // baaki code...


        case 'payment_intent.canceled':
        case 'payment_intent.payment_failed': {
            const paymentIntentFailure = event?.data.object as Stripe.PaymentIntent;
            const paymentIntentFailureId = paymentIntentFailure.id;

            //Getting session metadata
            const sessionFailure = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentFailureId
            })

            const failureOrderId = (sessionFailure.data[0].metadata as any).orderId;

            await prisma.order.delete({ where: { id: failureOrderId } })
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    // Return a response to acknowledge receipt of the event
    response.json({ received: true });
}