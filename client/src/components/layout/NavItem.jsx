import { NavLink, useLocation } from 'react-router-dom';

export default function NavItem({ to, icon, label, badge }) {
  const { pathname, state } = useLocation();
  // Order detail lives at /orders/:id for both buyers and sellers. When opened
  // from Incoming Orders, highlight that item instead of "My Orders".
  const fromBusinessOrders = state?.fromBusinessOrders && pathname.startsWith('/orders/');
  const override =
    fromBusinessOrders && to === '/dashboard/orders' ? true
      : fromBusinessOrders && to === '/orders' ? false
      : null;
  return (
    <NavLink
      to={to}
      end={to === '/dashboard' || to === '/admin'}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out-expo active:scale-[0.98] ${
          (override ?? isActive)
            ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <span className="transition-transform duration-200 ease-out-expo group-hover:scale-110">{icon}</span>
      <span className="flex-1 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5">{label}</span>
      {badge !== undefined && (
        <span key={badge} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full animate-pop-in">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
