import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Minus, Plus, ArrowLeft, Package, Loader2, AlertCircle, Store, ChevronRight, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';

export default function Cart() {
  const { items, loading, itemCount, updateQuantity, removeItem, clearAll } = useCart();
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Group items by store
  const storeGroups = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const listing = item.listing || {};
      const business = listing.business;
      const seller = listing.seller;

      const storeId = business?.id || seller?.id || 'unknown';
      const storeName = business?.name || (seller ? `${seller.first_name} ${seller.last_name}` : 'Unknown Seller');
      const storeSlug = business?.slug || null;
      const storeLogo = business?.logo_url || seller?.avatar_url || null;

      if (!groups[storeId]) {
        groups[storeId] = {
          storeId,
          storeName,
          storeSlug,
          storeLogo,
          isBusiness: !!business,
          items: [],
          subtotal: 0,
        };
      }
      groups[storeId].items.push(item);
      if (listing.status === 'active') {
        groups[storeId].subtotal += parseFloat(listing.price || 0) * item.quantity;
      }
    });

    return Object.values(groups).map(g => ({
      ...g,
      subtotal: Math.round(g.subtotal * 100) / 100,
    }));
  }, [items]);

  // All active (available) item IDs
  const activeItemIds = useMemo(() => {
    return items
      .filter(item => item.listing?.status === 'active')
      .map(item => item.id);
  }, [items]);

  // Selection helpers
  const allSelected = activeItemIds.length > 0 && activeItemIds.every(id => selectedIds.has(id));
  const someSelected = activeItemIds.some(id => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeItemIds));
    }
  }, [allSelected, activeItemIds]);

  const toggleStore = useCallback((storeItemIds) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allStoreSelected = storeItemIds.every(id => next.has(id));
      storeItemIds.forEach(id => {
        if (allStoreSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  }, []);

  const toggleItem = useCallback((itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Compute selected subtotals
  const selectedSummary = useMemo(() => {
    const groups = storeGroups.map(group => {
      const selectedItems = group.items.filter(item =>
        selectedIds.has(item.id) && item.listing?.status === 'active'
      );
      const groupSubtotal = selectedItems.reduce((sum, item) =>
        sum + parseFloat(item.listing.price || 0) * item.quantity, 0
      );
      return {
        ...group,
        selectedCount: selectedItems.length,
        selectedSubtotal: Math.round(groupSubtotal * 100) / 100,
      };
    });

    const totalSelectedItems = groups.reduce((sum, g) => sum + g.selectedCount, 0);
    const totalSubtotal = groups.reduce((sum, g) => sum + g.selectedSubtotal, 0);

    return {
      groups,
      totalSelectedItems,
      totalSubtotal: Math.round(totalSubtotal * 100) / 100,
    };
  }, [storeGroups, selectedIds]);

  const handleUpdateQuantity = async (cartItemId, newQty) => {
    if (newQty < 1) return;
    setUpdatingId(cartItemId);
    await updateQuantity(cartItemId, newQty);
    setUpdatingId(null);
  };

  const handleRemove = async (cartItemId) => {
    setRemovingId(cartItemId);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(cartItemId);
      return next;
    });
    await removeItem(cartItemId);
    setRemovingId(null);
  };

  const handleClearAll = async () => {
    setClearing(true);
    setSelectedIds(new Set());
    await clearAll();
    setClearing(false);
    setShowClearConfirm(false);
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="mt-1 text-gray-500">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} from {storeGroups.length} {storeGroups.length === 1 ? 'store' : 'stores'}
              </p>
            </div>
            <Link
              to="/marketplace"
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-8 h-8" />}
            title="Your cart is empty"
            description="Browse our marketplace to find eco-friendly products and recyclable materials."
            action={
              <Link to="/marketplace">
                <Button>Browse Marketplace</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items grouped by store */}
            <div className="lg:col-span-2 space-y-4">
              {/* Select All + Clear All bar */}
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      allSelected
                        ? 'bg-primary-600 border-primary-600'
                        : someSelected
                          ? 'bg-primary-100 border-primary-500'
                          : 'border-gray-300 hover:border-primary-400'
                    }`}
                  >
                    {allSelected && <Check className="w-3 h-3 text-white" />}
                    {!allSelected && someSelected && <div className="w-2 h-0.5 bg-primary-600 rounded" />}
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {allSelected ? 'Deselect All' : someSelected ? `Selected ${selectedSummary.totalSelectedItems} of ${activeItemIds.length}` : 'Select All'}
                  </span>
                </label>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              </div>

              {selectedSummary.groups.map(group => (
                <StoreGroup
                  key={group.storeId}
                  group={group}
                  selectedIds={selectedIds}
                  updatingId={updatingId}
                  removingId={removingId}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemove}
                  onToggleStore={toggleStore}
                  onToggleItem={toggleItem}
                />
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  {selectedSummary.groups.filter(g => g.selectedCount > 0).length > 1 && (
                    <div className="space-y-2">
                      {selectedSummary.groups.filter(g => g.selectedCount > 0).map(group => (
                        <div key={group.storeId} className="flex justify-between text-gray-500">
                          <span className="truncate max-w-[180px]">
                            {group.storeName}
                            <span className="text-gray-400 ml-1">({group.selectedCount})</span>
                          </span>
                          <span className="font-medium text-gray-700 flex-shrink-0">
                            ₱{group.selectedSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-gray-100 pt-2" />
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({selectedSummary.totalSelectedItems} items)</span>
                    <span className="font-medium text-gray-900">
                      ₱{selectedSummary.totalSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="text-gray-500">Calculated at checkout</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between">
                      <span className="text-base font-semibold text-gray-900">Estimated Total</span>
                      <span className="text-base font-bold text-primary-600">
                        ₱{selectedSummary.totalSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button className="w-full" disabled={selectedSummary.totalSelectedItems === 0}>
                    Proceed to Checkout
                  </Button>
                  {selectedSummary.totalSelectedItems === 0 && someSelected === false && items.length > 0 && (
                    <p className="text-xs text-center text-amber-600">
                      Select items to proceed
                    </p>
                  )}
                  <p className="text-xs text-center text-gray-400">
                    Checkout coming in future phase
                  </p>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      Items from different stores may be fulfilled separately. Items are not reserved.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Clear Cart Confirmation Modal */}
      <Modal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear Cart">
        <p className="text-gray-600 mb-6">
          Are you sure you want to remove all items from your cart? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearAll} disabled={clearing}>
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Clear Cart
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function StoreGroup({ group, selectedIds, updatingId, removingId, onUpdateQuantity, onRemove, onToggleStore, onToggleItem }) {
  const { storeName, storeSlug, storeLogo, isBusiness, items, selectedCount, selectedSubtotal } = group;
  const activeItems = items.filter(i => i.listing?.status === 'active');
  const activeItemIds = activeItems.map(i => i.id);
  const allStoreSelected = activeItemIds.length > 0 && activeItemIds.every(id => selectedIds.has(id));
  const someStoreSelected = activeItemIds.some(id => selectedIds.has(id));

  return (
    <Card className="overflow-hidden">
      {/* Store Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleStore(activeItemIds)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            allStoreSelected
              ? 'bg-primary-600 border-primary-600'
              : someStoreSelected
                ? 'bg-primary-100 border-primary-500'
                : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          {allStoreSelected && <Check className="w-3 h-3 text-white" />}
          {!allStoreSelected && someStoreSelected && <div className="w-2 h-0.5 bg-primary-600 rounded" />}
        </button>
        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
          {storeLogo ? (
            <img src={storeLogo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isBusiness && storeSlug ? (
            <Link
              to={`/establishments/${storeSlug}`}
              className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors flex items-center gap-1"
            >
              {storeName}
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          ) : (
            <span className="text-sm font-semibold text-gray-900">{storeName}</span>
          )}
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {selectedCount > 0 ? `${selectedCount}/${items.length}` : items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Store Items */}
      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <CartItem
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            updatingId={updatingId}
            removingId={removingId}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            onToggleItem={onToggleItem}
          />
        ))}
      </div>

      {/* Store Subtotal */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
        <span className="text-sm text-gray-500">
          {selectedCount > 0 && selectedCount < items.length ? 'Selected' : 'Store'} Subtotal:
        </span>
        <span className="ml-2 text-sm font-bold text-gray-900">
          ₱{(selectedCount > 0 ? selectedSubtotal : group.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </span>
      </div>
    </Card>
  );
}

function CartItem({ item, isSelected, updatingId, removingId, onUpdateQuantity, onRemove, onToggleItem }) {
  const listing = item.listing || {};
  const isUpdating = updatingId === item.id;
  const isRemoving = removingId === item.id;
  const isUnavailable = listing.status !== 'active';

  return (
    <div className={`p-4 ${isUnavailable ? 'bg-red-50' : ''} ${isSelected ? '' : 'opacity-60'}`}>
      <div className="flex gap-3">
        {/* Checkbox */}
        <div className="flex items-start pt-2">
          <button
            type="button"
            onClick={() => !isUnavailable && onToggleItem(item.id)}
            disabled={isUnavailable}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              isUnavailable
                ? 'border-gray-200 cursor-not-allowed'
                : isSelected
                  ? 'bg-primary-600 border-primary-600'
                  : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            {isSelected && !isUnavailable && <Check className="w-3 h-3 text-white" />}
          </button>
        </div>

        {/* Image */}
        <Link to={`/marketplace/${listing.slug}`} className="flex-shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden">
            {listing.primary_image ? (
              <img src={listing.primary_image} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/marketplace/${listing.slug}`}
                className="font-medium text-gray-900 hover:text-primary-600 transition-colors line-clamp-2 text-sm"
              >
                {listing.title}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">
                ₱{parseFloat(listing.price || 0).toLocaleString('en-PH')} / {listing.unit || 'piece'}
              </p>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              disabled={isRemoving}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {isUnavailable && (
            <div className="mt-1 text-xs text-red-600 font-medium">
              No longer available
            </div>
          )}

          <div className="mt-2 flex items-end justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                disabled={isUpdating || item.quantity <= 1 || isUnavailable}
                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center text-sm font-medium">
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= listing.quantity_available || isUnavailable}
                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="text-right">
              <p className="text-base font-bold text-primary-600">
                ₱{(parseFloat(listing.price || 0) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
