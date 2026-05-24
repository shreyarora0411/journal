// The "Book" tab is the Feed screen per the redesign brief (Batch B #07).
// We keep the route file name as `book.tsx` to avoid Expo Router state
// churn during the redesign; the floating-pill Nav primitive renames the
// surface to "Feed" visually.
import { FeedScreen } from '@/features/feed';

export default FeedScreen;
