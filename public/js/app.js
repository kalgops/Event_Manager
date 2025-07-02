// public/js/app.js
document.addEventListener('click', e => {
  if (e.target.matches('#create-event')) {
    e.preventDefault();
    axios.post('/organiser/events/new')
      .then(res => {
        const eventId = res.data.id;
        window.location.href = `/organiser/events/${eventId}/edit`; // Instant redirect
      })
      .catch(err => console.error(err));
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
