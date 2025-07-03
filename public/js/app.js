// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  // fade main content in
  gsap.to('#page-content', {
    duration: 0.8,
    opacity: 1,
    y: 0,
    ease: 'power2.out'
  });
});

// existing organiser AJAX handlers...
document.addEventListener('click', e => {
  // Create Event
  if (e.target.matches('#create-event')) {
    e.preventDefault();
    axios.post('/organiser/events/new')
      .then(r => {
        // inject new draft-card without reload
        const id = r.data.id;
        // simple nav to edit
        window.location = `/organiser/events/${id}/edit`;
      });
  }
  // Publish
  if (e.target.matches('.publish-btn')) {
    const id = e.target.dataset.id;
    axios.post(`/organiser/events/${id}/publish`)
      .then(_ => window.location.reload());
  }
  // Delete
  if (e.target.matches('.delete-btn')) {
    const id = e.target.dataset.id;
    if (!confirm('Delete forever?')) return;
    axios.delete(`/organiser/events/${id}`)
      .then(_ => window.location.reload());
  }
});
