import { createFileRoute } from '@tanstack/react-router';
import { OrderPage } from '../pages/OrderPage';

export const Route = createFileRoute('/orders/$id')({ component: OrderPage });
