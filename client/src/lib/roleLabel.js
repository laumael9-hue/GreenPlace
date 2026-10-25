// The 'admin' role is shown to users as "moderator"; the stored role value is unchanged.
export const roleLabel = (role) => (role === 'admin' ? 'moderator' : role);
