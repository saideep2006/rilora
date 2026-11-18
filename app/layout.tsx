import type { Metadata } from 'next';
import './globals.css';
import './motion.css';
import { Header, Footer, Chatbot, NetworkBackground, CollaborationTicker, RouteTransitionLoader, SocialRail, BackToTop, AnalyticsTracker, DevelopmentAnnouncement } from '@/components';
export const metadata: Metadata = { title: 'RILORA — Digital Solutions & Technology', description: 'Modern websites, digital products and opportunities to learn through contribution.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body><div className="ambient" aria-hidden="true"/><NetworkBackground/><div className="site-shell"><Header/><CollaborationTicker/>{children}<Footer/></div><SocialRail/><Chatbot/><BackToTop/><AnalyticsTracker/><RouteTransitionLoader/><DevelopmentAnnouncement/></body></html>; }
