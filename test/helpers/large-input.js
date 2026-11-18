'use strict';
// Builds a unit-file text of about `bytes` characters for the large-file test (invented data, many sections and entries).
function make(bytes) {
  const parts = ['[Unit]\nDescription=Large test unit\nAfter=network-online.target\n\n[Service]\nType=simple\nExecStart=/usr/bin/app\n'];
  let size = parts[0].length, i = 0;
  while (size < bytes) {
    const s = 'Environment=KEY_' + i + '=value-' + (i % 977) + '\n' + (i % 50 === 0 ? '# block ' + i + '\n[X-Block' + i + ']\nOwner=team-' + (i % 7) + '\n[Service]\n' : '');
    parts.push(s); size += s.length; i++;
  }
  parts.push('\n[Install]\nWantedBy=multi-user.target\n');
  return parts.join('');
}
module.exports = { make };
