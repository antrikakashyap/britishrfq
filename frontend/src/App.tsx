import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { ToastHost } from './components/Toast';
import Create from './pages/Create';
import Details from './pages/Details';
import Listing from './pages/Listing';

function Shell() {
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <Link to="/" className="brand">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#f2a900" /><path d="M7 21h12M7 15h18M7 9h8" stroke="#0f1f2e" strokeWidth="3" strokeLinecap="round" /></svg>
            British Auction RFQ
          </Link>
          <nav aria-label="Main">
            <NavLink to="/" end>Auctions</NavLink>
            <NavLink to="/new">New RFQ</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Listing />} />
          <Route path="/new" element={<Create />} />
          <Route path="/auctions/:key" element={<Details />} />
          <Route path="*" element={<div className="empty"><strong>Page not found</strong><Link to="/">Back to auctions</Link></div>} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost>
        <Shell />
      </ToastHost>
    </BrowserRouter>
  );
}
