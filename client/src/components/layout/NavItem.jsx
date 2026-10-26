import { NavLink } from 'react-router-dom';

export default function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard' || to === '/admin'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
