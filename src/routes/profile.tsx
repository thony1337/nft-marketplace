import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '../pages/ProfilePage';

// Sign-in is handled by the page itself (it asks for login), not by a redirect that reads storage
export const Route = createFileRoute('/profile')({ component: ProfilePage });
