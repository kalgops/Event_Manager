// public/js/app.js
document.addEventListener('click', e => {
  // Create new event
  if (e.target.matches('#create-event')) {
    e.preventDefault();
    
    // Disable button to prevent double-clicks
    e.target.disabled = true;
    e.target.textContent = 'Creating...';
    
    axios.post('/organiser/events/new')
      .then(res => {
        if (res.data.success) {
          // Redirect to edit page immediately
          window.location.href = `/organiser/events/${res.data.id}/edit`;
        } else {
          throw new Error('Failed to create event');
        }
      })
      .catch(err => {
        console.error('Error creating event:', err);
        alert('Failed to create event. Please try again.');
        
        // Re-enable button
        e.target.disabled = false;
        e.target.textContent = 'Create New Event';
      });
  }
  
  // Publish event
  if (e.target.matches('.publish-btn')) {
    e.preventDefault();
    const id = e.target.dataset.id;
    
    // Disable button during request
    e.target.disabled = true;
    const originalText = e.target.textContent;
    e.target.textContent = 'Publishing...';
    
    axios.post(`/organiser/events/${id}/publish`)
      .then(res => {
        if (res.data.success) {
          // Show success message briefly then reload
          e.target.textContent = 'Published!';
          e.target.classList.add('bg-green-500');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          throw new Error('Failed to publish');
        }
      })
      .catch(err => {
        console.error('Error publishing event:', err);
        alert('Failed to publish event. Please try again.');
        
        // Reset button
        e.target.disabled = false;
        e.target.textContent = originalText;
      });
  }
  
  // Delete event
  if (e.target.matches('.delete-btn')) {
    e.preventDefault();
    const id = e.target.dataset.id;
    
    if (!confirm('Delete this event forever? This action cannot be undone.')) {
      return;
    }
    
    // Disable button during request
    e.target.disabled = true;
    const originalText = e.target.textContent;
    e.target.textContent = 'Deleting...';
    
    axios.delete(`/organiser/events/${id}`)
      .then(res => {
        if (res.data.success) {
          // Remove the event from the page without full reload
          const eventItem = e.target.closest('li');
          if (eventItem) {
            eventItem.style.transition = 'opacity 0.3s';
            eventItem.style.opacity = '0';
            setTimeout(() => {
              eventItem.remove();
            }, 300);
          }
        } else {
          throw new Error('Failed to delete');
        }
      })
      .catch(err => {
        console.error('Error deleting event:', err);
        alert('Failed to delete event. Please try again.');
        
        // Reset button
        e.target.disabled = false;
        e.target.textContent = originalText;
      });
  }
});

// Add some visual feedback for better UX
document.addEventListener('DOMContentLoaded', () => {
  // Add loading states to buttons on hover
  const buttons = document.querySelectorAll('button, .btn');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) {
        btn.style.transform = 'translateY(-1px)';
        btn.style.transition = 'transform 0.2s';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
    });
  });
});