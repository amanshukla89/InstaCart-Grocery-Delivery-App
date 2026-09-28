import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../config/prisma.js";
import { Inngest } from "inngest";

const inngest = new Inngest({
    id: "instacart",
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const stripeWebhook = async (request: Request, response: Response) => {
    let event;

    if (endpointSecret) {
        const signature = request.headers["stripe-signature"];

        try {
            event = stripe.webhooks.constructEvent(
                request.body,
                signature as string,
                endpointSecret
            );
        } catch (error: any) {
            console.log(
                "⚠️ Webhook signature verification failed.",
                error.message
            );

            return response.sendStatus(400);
        }
    }

    if (!event) {
        return response.status(400).json({
            message: "Stripe event not received",
        });
    }

    switch (event.type) {

        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;

            const paymentIntentId = paymentIntent.id;

            console.log("========== STRIPE WEBHOOK ==========");
            console.log("Payment Intent:", paymentIntentId);

            // Find Checkout Session
            const session = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId,
            });

            console.log("Sessions:", session.data);

            if (!session.data.length) {
                console.log("❌ No checkout session found");

                return response.status(400).json({
                    message: "Checkout session not found",
                });
            }

            // Get order ID from Stripe metadata
            const orderId = session.data[0].metadata?.orderId;

            console.log("Order ID:", orderId);

            if (!orderId) {
                console.log("❌ No orderId in Stripe metadata");

                return response.status(400).json({
                    message: "Order ID missing",
                });
            }

            // Find order first
            const existingOrder = await prisma.order.findUnique({
                where: {
                    id: orderId,
                },
            });

            if (!existingOrder) {
                console.log("❌ Order not found in database:", orderId);

                return response.status(404).json({
                    message: "Order not found",
                });
            }

            // Mark order as paid
            const paidOrder = await prisma.order.update({
                where: {
                    id: orderId,
                },
                data: {
                    isPaid: true,
                },
            });

            console.log("✅ ORDER MARKED PAID:", paidOrder.id);
            console.log("✅ isPaid:", paidOrder.isPaid);

            // Decrease stock
            const orderItems = Array.isArray(paidOrder.items)
                ? (paidOrder.items as any[])
                : [];

            for (const item of orderItems) {
                await prisma.product.update({
                    where: {
                        id: item.product,
                    },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });
            }

            // Order placed event
            await inngest.send({
                name: "order/placed",
                data: {
                    orderId,
                },
            });

            // Stock update events
            for (const item of orderItems) {
                await inngest.send({
                    name: "inventory/stock.updated",
                    data: {
                        productId: item.product,
                    },
                });
            }

            break;
        }

        case "payment_intent.canceled":
        case "payment_intent.payment_failed": {
            const paymentIntentFailure =
                event.data.object as Stripe.PaymentIntent;

            const paymentIntentFailureId = paymentIntentFailure.id;

            const sessionFailure = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentFailureId,
            });

            if (!sessionFailure.data.length) {
                console.log("❌ No checkout session found for failed payment");

                break;
            }

            const failureOrderId =
                sessionFailure.data[0].metadata?.orderId;

            if (!failureOrderId) {
                console.log("❌ No orderId found for failed payment");

                break;
            }

            await prisma.order.delete({
                where: {
                    id: failureOrderId,
                },
            });

            console.log(
                "🗑️ Unpaid order deleted:",
                failureOrderId
            );

            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    return response.json({
        received: true,
    });
};