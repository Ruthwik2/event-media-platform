'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { User as UserType } from '@/types';
import { Search, Trash2, Users, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

      const res = await api.get(`/auth/users?${params.toString()}`);
      setUsers(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalUsers(res.data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      toast.success(`User "${userName}" deleted successfully`);
      setUsers(users.filter((u) => u.id !== userId));
      setTotalUsers((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  if (user?.role !== 'ADMIN') {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-900/50 text-red-400 border-red-800';
      case 'PHOTOGRAPHER':
        return 'bg-blue-900/50 text-blue-400 border-blue-800';
      case 'CLUB_MEMBER':
        return 'bg-purple-900/50 text-purple-400 border-purple-800';
      default:
        return 'bg-slate-900/50 text-slate-400 border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-slate-400">View and manage all users on the platform</p>
      </div>

      {/* Stats */}
      <div className="card p-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-400" />
        <div>
          <p className="text-sm text-slate-400">Total Users</p>
          <p className="text-xl font-bold">{totalUsers}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by username or full name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="input w-auto"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="PHOTOGRAPHER">Photographer</option>
          <option value="CLUB_MEMBER">Club Member</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : users.length > 0 ? (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Username</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Full Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Joined</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                              {u.fullName[0]}
                            </div>
                          )}
                          <span className="font-medium text-sm">@{u.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{u.fullName}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`badge border ${getRoleBadgeColor(u.role)} text-xs`}>
                          {u.role === 'CLUB_MEMBER' ? 'Club Member' : u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.fullName)}
                            className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {u.id === user?.id && (
                          <span className="text-xs text-slate-500 px-2">You</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-12 card">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No users found</p>
        </div>
      )}
    </div>
  );
}
