import { createFileRoute } from '@tanstack/react-router';
import { CheckoutPage } from '../pages/Checkout';

// Sign-in is handled by the page itself (it asks for login and keeps the cart), not by a redirect
export const Route = createFileRoute('/checkout')({ component: CheckoutPage });
