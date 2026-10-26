// Turns a raw status value ("ready_for_pickup", "COMPLETED") into display text ("Ready for pickup").
export function formatStatus(status) {
  if (!status) return '';
  const text = String(status).replace(/_/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Drop-off statuses are stored as scheduled/processed but shown to users as Pending/Completed.
const dropOffStatusLabels = {
  scheduled: 'Pending',
  processed: 'Completed',
};

export function formatDropOffStatus(status) {
  return dropOffStatusLabels[status] || formatStatus(status);
}
