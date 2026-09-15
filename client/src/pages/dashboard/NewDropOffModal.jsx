import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Loader2, Users, Search, X, UserCheck } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

export default function NewDropOffModal({ open, onClose, onCreated }) {
  const [materials, setMaterials] = useState([]);
  const [items, setItems] = useState([{ materialName: '', quantity: '', unit: 'kg' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMaterials, setFetchingMaterials] = useState(true);
  const [error, setError] = useState('');

  // Resident search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const searchTimeout = useRef(null);

  const fetchMaterials = useCallback(async () => {
    try {
      const { data } = await api.get('/drop-offs/materials');
      setMaterials(data.materials || []);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
    } finally {
      setFetchingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open, fetchMaterials]);

  // Search residents with debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 1 || isGuest) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/drop-offs/search-residents?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.residents || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, isGuest]);

  const selectResident = (resident) => {
    setSelectedResident(resident);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearResident = () => {
    setSelectedResident(null);
    setIsGuest(false);
    setGuestName('');
    setGuestPhone('');
  };

  const toggleGuestMode = () => {
    setIsGuest(!isGuest);
    setSelectedResident(null);
    setSearchQuery('');
    setSearchResults([]);
    setGuestName('');
    setGuestPhone('');
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { materialName: '', quantity: '', unit: 'kg' }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const getPriceForMaterial = (name) => {
    const mat = materials.find(m => m.material_name.toLowerCase() === name.toLowerCase());
    return mat ? parseFloat(mat.price_per_kg) : 0;
  };

  const getEstimatedValue = (index) => {
    const item = items[index];
    const qty = parseFloat(item.quantity) || 0;
    const price = getPriceForMaterial(item.materialName);
    return qty * price;
  };

  const totalWeight = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalValue = items.reduce((sum, _, i) => sum + getEstimatedValue(i), 0);

  const residentName = selectedResident
    ? `${selectedResident.first_name || ''} ${selectedResident.last_name || ''}`.trim()
    : isGuest ? guestName.trim() : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedResident && !isGuest) {
      setError('Search for a resident or toggle to guest mode');
      return;
    }

    if (isGuest && !guestName.trim()) {
      setError('Resident name is required');
      return;
    }

    const validItems = items.filter(i => i.materialName.trim() && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setError('At least one material with weight is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: validItems.map(i => ({
          materialName: i.materialName.trim(),
          quantity: parseFloat(i.quantity),
          unit: i.unit,
        })),
        notes: notes.trim() || null,
      };

      if (selectedResident) {
        payload.userId = selectedResident.id;
      } else {
        payload.guestName = guestName.trim();
        payload.guestPhone = guestPhone.trim() || null;
      }

      await api.post('/drop-offs', payload);
      onCreated();
      // Reset form
      setItems([{ materialName: '', quantity: '', unit: 'kg' }]);
      setSelectedResident(null);
      setIsGuest(false);
      setGuestName('');
      setGuestPhone('');
      setSearchQuery('');
      setNotes('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create drop-off');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Drop-off" maxWidth="max-w-xl">
      {fetchingMaterials ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Resident Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Resident</span>
              </div>
              <button
                type="button"
                onClick={toggleGuestMode}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {isGuest ? 'Search registered user' : 'Walk-in guest?'}
              </button>
            </div>

            {selectedResident ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{residentName}</p>
                    {selectedResident.phone && (
                      <p className="text-xs text-gray-500">{selectedResident.phone}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearResident}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isGuest ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Perez"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 09171234567"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((resident) => (
                      <button
                        key={resident.id}
                        type="button"
                        onClick={() => selectResident(resident)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                      >
                        <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {resident.first_name} {resident.last_name}
                          </p>
                          {resident.phone && (
                            <p className="text-xs text-gray-500">{resident.phone}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery && !searching && searchResults.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center">
                    <p className="text-sm text-gray-500">No residents found</p>
                    <button
                      type="button"
                      onClick={toggleGuestMode}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-1"
                    >
                      Record as guest instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Materials */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Materials</span>
                <span className="text-xs text-gray-400">({materials.length} available)</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={item.materialName}
                    onChange={(e) => handleItemChange(index, 'materialName', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select material</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.material_name}>
                        {m.material_name} — ₱{parseFloat(m.price_per_kg).toFixed(2)}/kg
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="kg"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {item.quantity ? `₱${getEstimatedValue(index).toFixed(2)}` : ''}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Weight</span>
              <span className="font-medium text-gray-900">{totalWeight.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Estimated Payout</span>
              <span className="font-bold text-primary-600">₱{totalValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (!selectedResident && !isGuest)}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</>
              ) : (
                'Record Drop-off'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
