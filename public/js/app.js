// ========================================
// app.js - Client-side JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  // Create new event handler
  const createEventBtn = document.getElementById('create-event');
  if (createEventBtn) {
    createEventBtn.addEventListener('click', async () => {
      try {
        const response = await axios.post('/organiser/events/new');
        if (response.data.id) {
          window.location.href = `/organiser/events/${response.data.id}/edit`;
        }
      } catch (error) {
        console.error('Error creating event:', error);
        alert('Failed to create event. Please try again.');
      }
    });
  }

  // Publish event buttons
  document.querySelectorAll('.publish-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const eventId = this.getAttribute('data-id');
      if (confirm('Are you sure you want to publish this event?')) {
        try {
          await axios.post(`/organiser/events/${eventId}/publish`);
          location.reload();
        } catch (error) {
          console.error('Error publishing event:', error);
          alert('Failed to publish event. Please try again.');
        }
      }
    });
  });

  // Delete event buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const eventId = this.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        try {
          await axios.delete(`/organiser/events/${eventId}`);
          location.reload();
        } catch (error) {
          console.error('Error deleting event:', error);
          alert('Failed to delete event. Please try again.');
        }
      }
    });
  });
});