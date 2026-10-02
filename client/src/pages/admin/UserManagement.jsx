import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Search, Users, ChevronLeft, ChevronRight, Shield,
  Ban, CheckCircle, Trash2, Eye, AlertTriangle, Clock, Building2, Download
} from 'lucide-react';

const ROLE_TABS = [
  { key: '', label: 'All Users', icon: Users },
  { key: 'resident', label: 'Residents', icon: Users },
  { key: 'business', label: 'Business Owners', icon: Building2 },
  { key: 'admin', label: 'Admins', icon: Shield },
];

export default function UserManagement() {
  const { profile: currentAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showImmediateDelete, setShowImmediateDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [dependencies, setDependencies] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, pendingDeletion: 0, deleted: 0 });
  const [businessMap, setBusinessMap] = useState({});
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      const { data } = await api.get(`/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/users/stats');
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchBusinesses = useCallback(async () => {
    try {
      const { data } = await api.get('/businesses/admin?limit=500');
      const map = {};
      (data.businesses || []).forEach(biz => {
        if (biz.owner_id) map[biz.owner_id] = biz;
      });
      setBusinessMap(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
    fetchStats();
  }, [fetchUsers, fetchStats]);

  useEffect(() => {
    if (roleFilter === 'business') {
      fetchBusinesses();
    }
  }, [roleFilter, fetchBusinesses]);

  useEffect(() => {
    const role = searchParams.get('role') || '';
    setRoleFilter(role);
  }, [searchParams]);

  const handleTabChange = (key) => {
    setRoleFilter(key);
    setSearch('');
    if (key) {
      setSearchParams({ role: key });
    } else {
      setSearchParams({});
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleExport = async () => {
    setError('');
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '500',
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      const { data } = await api.get(`/users?${params}`);
      const rows = (data.users || []).map((u) => [
        `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        u.email || '',
        u.phone || '',
        u.role,
        u.is_active ? 'Active' : 'Suspended',
        u.city || '',
        u.pending_deletion_at ? new Date(u.pending_deletion_at).toLocaleDateString() : '',
        u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
      ]);
      exportToCsv(
        csvFilename('greenplace-users'),
        ['Name', 'Email', 'Phone', 'Role', 'Status', 'City', 'Pending Deletion', 'Registered'],
        rows
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export users.');
    }
  };

  const openUserDetail = async (userId) => {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const { data } = await api.get(`/users/${userId}`);
      setSelectedUser(data.user);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDependencies = async (userId) => {
    try {
      const { data } = await api.get(`/users/${userId}/dependencies`);
      setDependencies(data.dependencies);
    } catch {
      setDependencies(null);
    }
  };

  const openDeactivateConfirm = async (user) => {
    setSelectedUser(user);
    setDeactivateReason('');
    setShowDeactivateConfirm(true);
  };

  const handleDeactivate = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await api.patch(`/users/${selectedUser.id}/toggle-active`, {
        reason: deactivateReason || undefined,
      });
      setSelectedUser(prev => prev ? { ...prev, is_active: false } : null);
      setShowDeactivateConfirm(false);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (userId) => {
    setActionLoading(true);
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      setSelectedUser(prev => prev ? { ...prev, is_active: true } : null);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openRoleModal = (user) => {
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    setActionLoading(true);
    try {
      await api.patch(`/users/${selectedUser.id}/role`, { role: newRole });
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      setShowRoleModal(false);
      fetchUsers(pagination.page);
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteConfirm = async (user) => {
    setSelectedUser(user);
    setDeleteConfirmText('');
    setDependencies(null);
    setShowDeleteConfirm(true);
    await fetchDependencies(user.id);
  };

  const handleGracePeriodDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { data } = await api.delete(`/users/${selectedUser.id}`);
      setSelectedUser(prev => prev ? {
        ...prev,
        pending_deletion_at: data.pending_deletion_at,
        is_active: false,
      } : null);
      setShowDeleteConfirm(false);
      setDependencies(null);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openImmediateDelete = async () => {
    setDeleteConfirmText('');
    setShowImmediateDelete(true);
  };

  const handleImmediateDelete = async () => {
    if (!selectedUser || deleteConfirmText !== 'DELETE') return;
    setActionLoading(true);
    try {
      await api.delete(`/users/${selectedUser.id}`, { data: { immediate: true } });
      setSelectedUser(null);
      setShowDeleteConfirm(false);
      setShowImmediateDelete(false);
      setDependencies(null);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (userId) => {
    setActionLoading(true);
    try {
      await api.patch(`/users/${userId}/reactivate`);
      setSelectedUser(prev => prev ? {
        ...prev,
        pending_deletion_at: null,
        deleted_at: null,
        is_active: true,
      } : null);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessExpired = async () => {
    setActionLoading(true);
    try {
      const { data } = await api.post('/users/process-expired-deletions');
      alert(data.message);
      fetchUsers(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const roleVariant = (role) => {
    const map = { admin: 'danger', business: 'info', resident: 'neutral' };
    return map[role] || 'neutral';
  };

  const hasDependencies = dependencies && Object.values(dependencies).some(v => v > 0);

  const getDeletionDate = (pendingDate) => {
    if (!pendingDate) return null;
    const date = new Date(pendingDate);
    date.setDate(date.getDate() + 30);
    return date;
  };

  const isPendingDeletion = (user) => user.pending_deletion_at && !user.deleted_at;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1">View and manage all user accounts.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = roleFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
            <p className="text-sm text-gray-500">Suspended</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.pendingDeletion}</p>
            <p className="text-sm text-gray-500">Pending Delete</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.deleted}</p>
            <p className="text-sm text-gray-500">Deleted</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={loading}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleProcessExpired}
          disabled={actionLoading}
        >
          <Clock className="w-4 h-4" />
          Process Expired Deletions
        </Button>
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No users found"
            description="No users match your search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  {roleFilter === 'business' && <th className="px-4 py-3">Business</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => {
                  const linkedBusiness = businessMap[user.id];
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${user.first_name} ${user.last_name}`}
                            src={user.avatar_url}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{user.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                      </td>
                      {roleFilter === 'business' && (
                        <td className="px-4 py-3">
                          {linkedBusiness ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{linkedBusiness.name}</p>
                                <Badge variant={linkedBusiness.status === 'approved' ? 'success' : linkedBusiness.status === 'suspended' ? 'danger' : 'warning'}>
                                  {linkedBusiness.status}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No business</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {isPendingDeletion(user) ? (
                          <Badge variant="warning">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending Delete
                          </Badge>
                        ) : (
                          <Badge variant={user.is_active ? 'success' : 'danger'}>
                            {user.is_active ? 'Active' : 'Suspended'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openUserDetail(user.id)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={!!selectedUser || detailLoading} onClose={() => setSelectedUser(null)} maxWidth="max-w-md">
        {detailLoading ? (
          <div className="py-8 text-center text-gray-500">Loading user details...</div>
        ) : selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                name={`${selectedUser.first_name} ${selectedUser.last_name}`}
                src={selectedUser.avatar_url}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedUser.first_name} {selectedUser.last_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{selectedUser.phone || 'Not set'}</p>
              </div>
              <div>
                <p className="text-gray-500">Role</p>
                <Badge variant={roleVariant(selectedUser.role)}>{selectedUser.role}</Badge>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                {isPendingDeletion(selectedUser) ? (
                  <Badge variant="warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending Delete
                  </Badge>
                ) : (
                  <Badge variant={selectedUser.is_active ? 'success' : 'danger'}>
                    {selectedUser.is_active ? 'Active' : 'Suspended'}
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-gray-500">Joined</p>
                <p className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Address</p>
                <p className="font-medium">
                  {[selectedUser.address, selectedUser.city, selectedUser.province]
                    .filter(Boolean).join(', ') || 'Not set'}
                </p>
              </div>
              {selectedUser.bio && (
                <div className="col-span-2">
                  <p className="text-gray-500">Bio</p>
                  <p className="font-medium">{selectedUser.bio}</p>
                </div>
              )}
              {selectedUser.suspension_reason && (
                <div className="col-span-2">
                  <p className="text-gray-500">Suspension Reason</p>
                  <p className="font-medium text-red-600">{selectedUser.suspension_reason}</p>
                </div>
              )}
              {isPendingDeletion(selectedUser) && (
                <div className="col-span-2">
                  <p className="text-gray-500">Scheduled Deletion</p>
                  <p className="font-medium text-amber-600">
                    {getDeletionDate(selectedUser.pending_deletion_at)?.toLocaleDateString()}
                    <span className="text-sm text-gray-500 ml-2">
                      ({Math.ceil((getDeletionDate(selectedUser.pending_deletion_at) - new Date()) / (1000 * 60 * 60 * 24))} days left)
                    </span>
                  </p>
                </div>
              )}
              {selectedUser.role === 'business' && businessMap[selectedUser.id] && (
                <div className="col-span-2">
                  <p className="text-gray-500">Linked Business</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <p className="font-medium">{businessMap[selectedUser.id].name}</p>
                    <Badge variant={businessMap[selectedUser.id].status === 'approved' ? 'success' : businessMap[selectedUser.id].status === 'suspended' ? 'danger' : 'warning'}>
                      {businessMap[selectedUser.id].status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {selectedUser.id !== currentAdmin?.id && !selectedUser.deleted_at && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {isPendingDeletion(selectedUser) ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleReactivate(selectedUser.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Reactivate (Cancel Deletion)
                  </Button>
                ) : selectedUser.is_active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => openDeactivateConfirm(selectedUser)}
                  >
                    <Ban className="w-4 h-4" />
                    Suspend
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleActivate(selectedUser.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Reactivate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openRoleModal(selectedUser)}
                >
                  <Shield className="w-4 h-4" />
                  Change Role
                </Button>
                {!isPendingDeletion(selectedUser) && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => openDeleteConfirm(selectedUser)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}

            {selectedUser.deleted_at && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-200">
                This account was permanently deleted on {new Date(selectedUser.deleted_at).toLocaleDateString()}.
                All personal data has been anonymized.
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showDeactivateConfirm} onClose={() => setShowDeactivateConfirm(false)} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Suspend User</h3>
              <p className="text-sm text-gray-500">
                {selectedUser?.first_name} {selectedUser?.last_name}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            This will immediately log the user out and prevent them from logging in.
            You can reactivate them later.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="e.g., Violation of terms..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDeactivateConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeactivate} disabled={actionLoading}>
              {actionLoading ? 'Suspending...' : 'Suspend User'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showRoleModal} onClose={() => setShowRoleModal(false)} maxWidth="max-w-sm">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Change Role</h3>
          <p className="text-sm text-gray-500">
            Change the role for {selectedUser?.first_name} {selectedUser?.last_name}
          </p>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="resident">Resident</option>
            <option value="business">Business</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowRoleModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleRoleChange} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDependencies(null); }} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Schedule Account Deletion</h3>
              <p className="text-sm text-gray-500">
                {selectedUser?.first_name} {selectedUser?.last_name}
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>30-day grace period.</strong> The user will be immediately
              logged out and cannot log back in. Their data will be preserved
              for 30 days, then permanently anonymized. You can reactivate
              the account within this period.
            </p>
          </div>

          {dependencies && hasDependencies && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">Active data (will be cancelled on final deletion):</p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-0.5">
                {dependencies.orders > 0 && <li>{dependencies.orders} active order(s)</li>}
                {dependencies.dropOffs > 0 && <li>{dependencies.dropOffs} pending drop-off(s)</li>}
                {dependencies.listings > 0 && <li>{dependencies.listings} active listing(s)</li>}
                {dependencies.forumThreads > 0 && <li>{dependencies.forumThreads} forum thread(s)</li>}
                {dependencies.forumPosts > 0 && <li>{dependencies.forumPosts} forum post(s)</li>}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirm(false); setDependencies(null); }}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={openImmediateDelete}>
              <Trash2 className="w-4 h-4" />
              Delete Immediately
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleGracePeriodDelete}
              disabled={actionLoading}
            >
              <Clock className="w-4 h-4" />
              {actionLoading ? 'Scheduling...' : 'Schedule Deletion (30 days)'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showImmediateDelete} onClose={() => setShowImmediateDelete(false)} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Immediate Permanent Delete</h3>
              <p className="text-sm text-gray-500">
                {selectedUser?.first_name} {selectedUser?.last_name}
              </p>
            </div>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>This cannot be undone.</strong> All personal data will be
              immediately anonymized. The user will be permanently logged out
              and all active orders/drop-offs will be cancelled.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImmediateDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleImmediateDelete}
              disabled={actionLoading || deleteConfirmText !== 'DELETE'}
            >
              {actionLoading ? 'Deleting...' : 'Permanently Delete Now'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
