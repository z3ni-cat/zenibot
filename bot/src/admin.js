// Helper admin: dipakai plugin di folder plugin/ maupun owner/.
// Dipindah ke sini agar tidak ada ketergantungan silang antar folder plugin.
export function isAdmin(config, sender, senderNumber) {
  const owners = config.owner || []
  return owners.some((o) => {
    const clean = String(o).replace(/[^0-9]/g, '')
    return sender === o || senderNumber === clean
  })
}
